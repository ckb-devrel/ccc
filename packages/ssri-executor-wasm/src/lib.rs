mod error;
mod ssri_vm;
mod types;

use crate::error::Error;
use std::{cell::RefCell, str::FromStr};

use wasm_bindgen_futures::wasm_bindgen::prelude::*;
use web_sys::{js_sys::SharedArrayBuffer, XmlHttpRequest};

use log::debug;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_wasm_bindgen::Serializer;
use ssri_vm::execute_riscv_binary;
use types::{Cell, CellOutputWithData, Hex, Order, Pagination, SearchKey, VmResult};

use ckb_jsonrpc_types::{
    CellOutput, Either, JsonBytes, Script, TransactionView, TransactionWithStatusResponse, Uint32,
};
use ckb_types::H256;

static SERIALIZER: Serializer = Serializer::new()
    .serialize_large_number_types_as_bigints(true)
    .serialize_maps_as_objects(true);

thread_local! {
    static INPUT_BUFFER: RefCell<Option<SharedArrayBuffer>> = const { RefCell::new(None) };
    static OUTPUT_BUFFER: RefCell<Option<SharedArrayBuffer>> = const { RefCell::new(None) };
}

static mut RPC_URL: &str = "https://testnet.ckb.dev/";

#[wasm_bindgen]
pub fn set_shared_array(input: JsValue, output: JsValue) {
    console_error_panic_hook::set_once();
    
    INPUT_BUFFER.with(|v| {
        match input.dyn_into() {
            Ok(buffer) => *v.borrow_mut() = Some(buffer),
            Err(e) => debug!("Failed to set input buffer: {:?}", e),
        }
    });
    
    OUTPUT_BUFFER.with(|v| {
        match output.dyn_into() {
            Ok(buffer) => *v.borrow_mut() = Some(buffer),
            Err(e) => debug!("Failed to set output buffer: {:?}", e),
        }
    });
}

#[wasm_bindgen]
extern "C" {
    fn post_message_to_worker(message: &str);
}

#[wasm_bindgen]
pub async fn initiate(log_level: String, rpc_url: String) -> Result<(), JsValue> {
    unsafe { RPC_URL = Box::leak(rpc_url.into_boxed_str()) };
    wasm_logger::init(wasm_logger::Config::new(
        log::Level::from_str(&log_level).expect("Bad log level"),
    ));
    debug!("Initiated!");
    Ok(())
}

#[wasm_bindgen]
pub fn run_script_level_code(
    tx_hash: &str,
    index: u32,
    args: Vec<JsValue>,
    script_debug: bool,
) -> Result<JsValue, JsValue> {
    let tx_hash = H256::from_str(&tx_hash[2..]).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let args: Vec<Hex> = args
        .into_iter()
        .map(|v| serde_wasm_bindgen::from_value(v))
        .collect::<Result<_, _>>()?;
    let result = run_script(script_debug, tx_hash, index, args, None, None, None)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(result.serialize(&SERIALIZER)?)
}

#[wasm_bindgen]
pub fn run_script_level_script(
    tx_hash: &str,
    index: u32,
    args: Vec<JsValue>,
    script: JsValue,
    script_debug: bool,
) -> Result<JsValue, JsValue> {
    let tx_hash = H256::from_str(&tx_hash[2..]).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let args: Vec<Hex> = args
        .into_iter()
        .map(|v| serde_wasm_bindgen::from_value(v))
        .collect::<Result<_, _>>()?;
    let script: Script = serde_wasm_bindgen::from_value(script)?;

    let result = run_script(script_debug, tx_hash, index, args, Some(script), None, None)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(result.serialize(&SERIALIZER)?)
}

#[wasm_bindgen]
pub fn run_script_level_cell(
    tx_hash: &str,
    index: u32,
    args: Vec<JsValue>,
    cell: JsValue,
    script_debug: bool,
) -> Result<JsValue, JsValue> {
    let tx_hash = H256::from_str(&tx_hash[2..]).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let args: Vec<Hex> = args
        .into_iter()
        .map(|v| serde_wasm_bindgen::from_value(v))
        .collect::<Result<_, _>>()?;
    let cell: CellOutputWithData = serde_wasm_bindgen::from_value(cell)?;

    let result = run_script(script_debug, tx_hash, index, args, None, Some(cell), None)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(result.serialize(&SERIALIZER)?)
}

#[wasm_bindgen]
pub fn run_script_level_tx(
    tx_hash: &str,
    index: u32,
    args: Vec<JsValue>,
    tx: JsValue,
    script_debug: bool,
) -> Result<JsValue, JsValue> {
    let tx_hash = H256::from_str(&tx_hash[2..]).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let args: Vec<Hex> = args
        .into_iter()
        .map(|v| serde_wasm_bindgen::from_value(v))
        .collect::<Result<_, _>>()?;
    let tx: TransactionView = serde_wasm_bindgen::from_value(tx)?;

    let result = run_script(script_debug, tx_hash, index, args, None, None, Some(tx))
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(result.serialize(&SERIALIZER)?)
}

pub fn get_cells(
    search_key: SearchKey,
    order: Order,
    limit: u32,
    after_cursor: Option<Vec<u8>>,
) -> Result<Pagination<Cell>, JsValue> {
    let limit = Uint32::from(limit);
    let cells = call_rpc::<Pagination<Cell>>("get_cells", (search_key, order, limit, after_cursor))
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(cells)
}

fn run_script(
    script_debug: bool,
    tx_hash: H256,
    index: u32,
    args: Vec<Hex>,
    script: Option<Script>,
    cell: Option<CellOutputWithData>,
    tx: Option<TransactionView>,
) -> Result<VmResult, Error> {
    debug!("Running script");
    let ssri_binary = get_cell(&tx_hash, index)
        .map_err(|_e| Error::Runtime("Cell not found".to_string()))?
        .ok_or(Error::Runtime("Cell not found".to_string()))?
        .1
        .into_bytes();

    let script = script.map(Into::into);
    let cell = cell.map(Into::into);
    let tx = tx.map(|v| v.inner.into());
    let description = format!(
        "Script {tx_hash}:{index} with args {args:?} context\nscript: {script:?}\ncell: {cell:?}\ntx: {tx:?}"
    );

    let args = args.into_iter().map(|v| v.hex.into()).collect();
    let res = execute_riscv_binary(script_debug, ssri_binary, args, script, cell, tx)
        .map_err(|e| Error::Runtime(e.to_string()))?;
    Ok(res)
}

pub fn get_cell(tx_hash: &H256, index: u32) -> Result<Option<(CellOutput, JsonBytes)>, JsValue> {
    let tx = get_transaction(tx_hash)?;
    let tx = match tx {
        Some(TransactionWithStatusResponse {
            transaction: Some(tx),
            ..
        }) => tx.inner,
        _ => return Ok(None),
    };
    let tx = match tx {
        Either::Left(view) => view,
        Either::Right(bytes) => match serde_json::from_slice(&bytes.into_bytes()) {
            Err(_) => return Ok(None),
            Ok(view) => view,
        },
    }
    .inner;

    let output = tx.outputs.get(index as usize);
    let data = tx.outputs_data.get(index as usize);
    match (output, data) {
        (Some(output), Some(data)) => Ok(Some((output.clone(), data.clone()))),
        _ => Ok(None),
    }
}

pub fn get_transaction(tx_hash: &H256) -> Result<Option<TransactionWithStatusResponse>, JsValue> {
    let tx = call_rpc::<TransactionWithStatusResponse>("get_transaction", [tx_hash])
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    Ok(Some(tx)) // Return the tx option
}

pub fn call_rpc<R: DeserializeOwned>(method: &str, params: impl Serialize) -> Result<R, Error> {
    debug!("Calling RPC method: {}", method);
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 0,
    });

    let xhr = XmlHttpRequest::new()
        .map_err(|_e| Error::Runtime("Failed to create XMLHttpRequest".to_string()))?;

    xhr.open_with_async("POST", unsafe { RPC_URL }, false)
        .map_err(|_e| Error::Runtime("Failed to open XMLHttpRequest".to_string()))?;

    xhr.set_request_header("Content-Type", "application/json")
        .map_err(|_e| Error::Runtime("Failed to set request header".to_string()))?;

    // Convert the request to a string
    let request_body = serde_json::to_string(&request)
        .map_err(|e| Error::Runtime(format!("Failed to serialize request: {}", e)))?;

    debug!("Request body: {}", request_body);

    // Send the request with the JSON body
    xhr.send_with_opt_str(Some(&request_body))
        .map_err(|_e| Error::Runtime("Failed to send request".to_string()))?;

    // Wait for the response
    let response_text = xhr
        .response_text()
        .map_err(|_e| Error::Runtime("Failed to get response text".to_string()))?
        .ok_or_else(|| Error::Runtime("Empty response".to_string()))?;
    // Parse the response
    let response: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| Error::Runtime(format!("Failed to parse response: {}", e)))?;
    // Extract the result field
    let result = response
        .get("result")
        .ok_or_else(|| Error::Runtime("No result field in response".to_string()))?;
    debug!("Result: {}", result);
    // Deserialize the result into the expected type
    serde_json::from_value(result.clone())
        .map_err(|e| Error::Runtime(format!("Failed to deserialize result: {}", e)))
}
