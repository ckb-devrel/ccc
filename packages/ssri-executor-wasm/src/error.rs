use std::fmt::Display;

#[derive(Debug)]
#[repr(i32)]
#[allow(clippy::enum_variant_names)]
pub enum Error {
    Encoding(&'static str),
    InvalidRequest(&'static str),
    Script(i8),
    Vm(String),
    Runtime(String),
}

impl Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Encoding(msg) => write!(f, "Encoding error: {}", msg),
            Error::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            Error::Script(code) => write!(f, "Script returns {}", code),
            Error::Vm(msg) => write!(f, "VM error: {}", msg),
            Error::Runtime(msg) => write!(f, "Runtime error: {}", msg),
        }
    }
}
