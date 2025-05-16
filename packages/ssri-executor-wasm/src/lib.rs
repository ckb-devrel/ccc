mod error;
mod ssri_vm;
mod types;

use crate::error::Error;
use std::{cell::RefCell, collections::HashMap, str::FromStr};

use wasm_bindgen_futures::wasm_bindgen::prelude::*;
use web_sys::BroadcastChannel;

use log::debug;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_wasm_bindgen::Serializer;
use ssri_vm::execute_riscv_binary;
use types::{
    BroadcastChannelMessagePacket, Cell, CellOutputWithData, GetCellsArguments, Hex, Order,
    Pagination, SearchKey, VmResult
};

use ckb_jsonrpc_types::{
    CellOutput, Either, JsonBytes, Script, TransactionView, TransactionWithStatusResponse
};
use ckb_types::H256;

static SERIALIZER: Serializer = Serializer::new()
    .serialize_large_number_types_as_bigints(true)
    .serialize_maps_as_objects(true);

thread_local! {
    static CHANNEL: RefCell<Option<BroadcastChannel>> = RefCell::new(None);
    static GET_TRANSACTION_CACHE: RefCell<HashMap<H256, TransactionWithStatusResponse>> = RefCell::new(HashMap::with_capacity(10000));
    static GET_CELLS_CACHE: RefCell<HashMap<String, Pagination<Cell>>> = RefCell::new(HashMap::with_capacity(10000));
}

#[wasm_bindgen]
pub fn put_get_transaction_cache(tx_hash: &str, transaction_with_status_response_string: &str) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    debug!("WASM putting get_transaction_cache");
    let tx_hash = H256::from_str(&tx_hash[2..]).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let transaction_with_status_response_object: serde_json::Value = serde_json::from_str(&transaction_with_status_response_string)
    .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let transaction_with_status_response: TransactionWithStatusResponse = serde_json::from_value(transaction_with_status_response_object).map_err(|e| JsValue::from_str(&e.to_string()))?;
    GET_TRANSACTION_CACHE.with(|v| v.borrow_mut().insert(tx_hash.clone(), transaction_with_status_response));
    Ok(())
}

#[wasm_bindgen]
pub fn put_get_cells_cache(
    search_key: JsValue,
    order: JsValue,
    limit: JsValue,
    after_cursor: JsValue,
    cells_string: &str,
) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    debug!("WASM putting get_cells cache");
    let search_key: SearchKey = serde_wasm_bindgen::from_value(search_key)?;
    let order: Order = serde_wasm_bindgen::from_value(order)?;
    let limit: u32 = serde_wasm_bindgen::from_value(limit)?;
    let after_cursor: Option<Vec<u8>> = serde_wasm_bindgen::from_value(after_cursor)?;
    let cells_json: serde_json::Value = serde_json::from_str(&cells_string).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let cells: Pagination<Cell> = serde_json::from_value(cells_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let cache_key_string = format!("{:?}", (search_key, order, limit, after_cursor));
    GET_CELLS_CACHE.with(|v| {
        v.borrow_mut()
            .insert(cache_key_string, cells)
    });
    debug!("WASM put get cells cache successfully");
    Ok(())
}

#[wasm_bindgen]
pub async fn initiate(
    log_level: String,
    channel_name: Option<String>,
) -> Result<(), JsValue> {
    // Initialize logger
    wasm_logger::init(wasm_logger::Config::new(
        log::Level::from_str(&log_level).expect("Bad log level"),
    ));

    // Initialize broadcast channel
    debug!(
        "Initializing broadcast channel with name: {}",
        channel_name.clone().unwrap_or("ssri-executor".into())
    );
    let channel_name = channel_name.unwrap_or("ssri-executor".into());
    let channel = BroadcastChannel::new(&channel_name)?;

    CHANNEL.with(|v| *v.borrow_mut() = Some(channel));

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
    let cache_key = (
        search_key.clone(),
        order.clone(),
        limit,
        after_cursor.clone(),
    );
    let cache_key_string = format!("{:?}", cache_key);

    let cached_cells = GET_CELLS_CACHE.with(|cache| {
        // Try direct lookup first. Might fail.
        if let Some(cells) = cache.borrow().get(&cache_key_string) {
            let cells_json = serde_json::to_string(cells).ok()?;
            let cells_owned: Pagination<Cell> = serde_json::from_str(&cells_json).ok()?;
            return Some(cells_owned);
        }
        
        // Fall back to manual lookup if direct lookup fails
        for (existing_key, cells) in cache.borrow().iter() {
            if format!("{:?}", existing_key) == cache_key_string {
                debug!("Found matching key based on string representation");
                let cells_json = serde_json::to_string(cells).ok()?;
                let cells_owned: Pagination<Cell> = serde_json::from_str(&cells_json).ok()?;
                return Some(cells_owned);
            }
        }
        
        None
    });
    
    if let Some(cells) = cached_cells {
        debug!("Get Cells Cache hit in WASM!");
        return Ok(cells);
    };
    debug!("Get Cells Cache missed in WASM, sending update request message to ssriRpcWorker!");

    let message = BroadcastChannelMessagePacket {
        sender_name: "ssriExecutorWasm".to_string(),
        target_name: "ssriRpcWorker".to_string(),
        message_label: "getCells".to_string(),
        data_type_hint: "GetCellsArguments".to_string(),
        data: serde_json::to_value(&GetCellsArguments {
            search_key,
            order,
            limit: limit.into(),
            after_cursor: after_cursor
                .map_or_else(|| JsonBytes::default(), |v| JsonBytes::from_vec(v)),
        })
        .unwrap(),
    };

    CHANNEL.with(|v| {
        if let Some(channel) = &*v.borrow() {
            debug!("WASM posting message to get cells");
            channel.post_message(&serde_wasm_bindgen::to_value(&message).unwrap())?;
        }
        Ok::<_, JsValue>(())
    })?;

    Err(JsValue::from_str(
        "GetCells message sent, shall be available in next iteration!",
    ))
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

    let args = args.into_iter().map(|v| v.hex.into()).collect();
    let res = execute_riscv_binary(script_debug, ssri_binary, args, script, cell, tx)
        .map_err(|e| Error::Runtime(e.to_string()));
    match res {
        Ok(output) => {
            debug!("Got output successfully. Clearing caches.");
            GET_TRANSACTION_CACHE.with(|v| v.borrow_mut().clear());
            GET_CELLS_CACHE.with(|v| v.borrow_mut().clear());
            Ok(output)
        }
        _ => Err(Error::Runtime("Script execution failed".to_string())),
    }
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
    let cached_tx = GET_TRANSACTION_CACHE.with(|cache| {
        if let Some(tx) = cache.borrow().get(tx_hash) {
            // Convert to Option<TransactionWithStatusResponse> by deserializing from a serialized version
            // This avoids cloning the non-cloneable type
            let tx_json = serde_json::to_string(tx).ok()?;
            let tx_owned: TransactionWithStatusResponse = serde_json::from_str(&tx_json).ok()?;
            Some(tx_owned)
        } else {
            None
        }
    });

    if let Some(tx) = cached_tx {
        debug!("Get Transaction Cache hit in WASM!");
        return Ok(Some(tx));
    };
    debug!("Get Transaction Cache missed in WASM, sending update request message to ssriRpcWorker!");

    let message = BroadcastChannelMessagePacket {
        sender_name: "ssriExecutorWasm".to_string(),
        target_name: "ssriRpcWorker".to_string(),
        message_label: "getTransaction".to_string(),
        data_type_hint: "H256".to_string(),
        data: serde_json::to_value(&tx_hash).unwrap(),
    };

    CHANNEL.with(|v| {
        if let Some(channel) = &*v.borrow() {
            channel.post_message(&serde_wasm_bindgen::to_value(&message).unwrap())?;
        }
        Ok::<_, JsValue>(())
    })?;

    Err(JsValue::from_str(
        "Message sent, shall be available in next iteration!",
    ))
}