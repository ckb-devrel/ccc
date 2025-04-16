const { FiberSDK } = require("../dist.commonjs/index.js");

// Custom error handling function
function handleRPCError(error) {
  if (error.error && error.error.code === -32601) {
    console.error(
      "Error: Node may not be running or RPC method does not exist",
    );
    console.error("Please ensure:");
    console.error("1. Fiber node is started");
    console.error(
      "2. Node RPC address is correct (current: http://127.0.0.1:8227)",
    );
    console.error("3. Node RPC interface is available");
  } else if (error.error && error.error.code === -32602) {
    console.error("Error: Invalid parameter");
    console.error("Please check:");
    console.error("1. Whether the parameter type is correct");
    console.error("2. Whether the parameter value is within the valid range");
    console.error("3. Whether all required parameters are provided");
  } else {
    console.error("RPC error:", error.message);
    if (error.error && error.error.data) {
      console.error("Error details:", error.error.data);
    }
  }
}

// Convert hexadecimal string to number
function hexToNumber(hex) {
  return parseInt(hex.replace("0x", ""), 16);
}

async function testSendPayment() {
  try {
    // Initialize SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("Starting test to send payment...\n");

    try {
      // Send payment
      console.log("Calling sendPayment method...");
      await sdk.payment.sendPayment({
        invoice:
          "fibt1000000001pcsaug0p0exgfw0pnm6vkkya5ul6wxurhh09qf9tuwwaufqnr3uzwpplgcrjpeuhe6w4rudppfkytvm4jekf6ymmwqk2h0ajvr5uhjpwfd9aga09ahpy88hz2um4l9t0xnpk3m9wlf22m2yjcshv3k4g5x7c68fn0gs6a35dw5r56cc3uztyf96l55ayeuvnd9fl4yrt68y086xn6qgjhf4n7xkml62gz5ecypm3xz0wdd59tfhtrhwvp5qlps959vmpf4jygdkspxn8xalparwj8h9ts6v6v0rf7vvhhku40z9sa4txxmgsjzwqzme4ddazxrfrlkc9m4uysh27zgqlx7jrfgvjw7rcqpmsrlga",
      });
      console.log("Payment sent successfully");
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("Payment sending failed:", error.message);
      }
    }

    console.log("\nTest completed!");
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("Error occurred during test:", error.message);
    }
  }
}

async function testGetPayment() {
  try {
    // Initialize SDK
    const sdk = new FiberSDK({
      endpoint: "http://127.0.0.1:8227",
      timeout: 5000,
    });

    console.log("Starting test to get payment...\n");

    try {
      // Get payment
      console.log("Calling getPayment method...");
      const paymentHash = "payment_hash"; // Replace with actual payment_hash
      const payment = await sdk.payment.getPayment(paymentHash);
      console.log("Payment information:", JSON.stringify(payment, null, 2));

      // Output detailed information
      console.log("\nPayment detailed information:");
      console.log("Status:", payment.status);
      console.log("Payment hash:", payment.payment_hash);
      console.log(
        "Created time:",
        new Date(hexToNumber(payment.created_at)).toLocaleString(),
      );
      console.log(
        "Last updated time:",
        new Date(hexToNumber(payment.last_updated_at)).toLocaleString(),
      );
      if (payment.failed_error) {
        console.log("Failure reason:", payment.failed_error);
      }
      console.log("Fee:", hexToNumber(payment.fee));
    } catch (error) {
      if (error.error) {
        handleRPCError(error);
      } else {
        console.error("Payment getting failed:", error.message);
      }
    }

    console.log("\nTest completed!");
  } catch (error) {
    if (error.error) {
      handleRPCError(error);
    } else {
      console.error("Error occurred during test:", error.message);
    }
  }
}

// Run all tests
console.log("Starting to run payment related tests...\n");

testSendPayment().catch(console.error);
