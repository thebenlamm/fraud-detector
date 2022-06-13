const uaparser = require('ua-parser-js'),
      fs = require('fs'),
      { getAccountAge, getCustomerHistory, getOrderInfo } = require('./queries.js');

const processOrder = async (orderId) => {
    const orderInfo = await getOrderInfo(orderId);
    if (!orderInfo) return;
    const accountAge = await getAccountAge(orderInfo.customerId, orderInfo.orderDate);

    const orderHistory = await getCustomerHistory(orderInfo.customerId, orderId);

    const ua = uaparser(orderInfo.userAgent);

    const prompt = `customer name: ${orderInfo.customerName}
order date: ${orderInfo.orderDate}
customer address: ${orderInfo.customerAddress}
customer phone: ${orderInfo.customerPhone}
customer email: ${orderInfo.customerEmail}
order payment method: ${orderInfo.paymentMethod}
delivery type: ${orderInfo.deliveryType}
order items: ${JSON.stringify(orderInfo.items)}
order total: $${orderInfo.orderTotal}
order history (last 20): ${JSON.stringify(orderHistory.slice(-20))}
total orders (all time): ${orderHistory.length}
device type: ${ua.device.type || 'unknown'}
device vendor: ${ua.device.vendor || 'unknown'}
browser: ${ua.browser.name || 'unknown'}
account age: ${accountAge} days\n\n###\n\n`.toLowerCase();

    const completion = ` ${orderInfo.chargeback || orderInfo.declined ? 'yes' : 'no'}`;

    return { prompt, completion };
};

const chargebackOrders = JSON.parse(fs.readFileSync('./data/chargeback_fraud.json', 'utf8'));
const declinedOrders = JSON.parse(fs.readFileSync('./data/declined_orders.json', 'utf8'));
const goodOrders = JSON.parse(fs.readFileSync('./data/good_orders.json', 'utf8'));

const runner = async () => {
    const fineTune = [];

    // Get 100 orders from each order list and process them
    const chargebackOrders100 = chargebackOrders.slice(0, 5);
    const declinedOrders100 = declinedOrders.slice(0, 5);
    const goodOrders100 = goodOrders.slice(0, 5);
    for (let i = 0; i < chargebackOrders100.length; i++) {
        try {
            const output = await processOrder(chargebackOrders100[i]);
            if (output) {
                fs.writeFileSync(`./prompts/chargeback_order_${chargebackOrders100[i]}.txt`, output.prompt + output.completion);
                fineTune.push(output);
            }
        } catch (err) {
            console.error(err);
            console.log(`Error processing order ${chargebackOrders100[i]}`);
        }
    }
    for (let i = 0; i < declinedOrders100.length; i++) {
        try {
            const output = await processOrder(declinedOrders100[i]);
            if (output) {
                fs.writeFileSync(`./prompts/declined_order_${declinedOrders100[i]}.txt`, output.prompt + output.completion);
                fineTune.push(output);
            }
        } catch (err) {
            console.error(err);
            console.log(`Error processing order ${declinedOrders100[i]}`);
        }
    }
    for (let i = 0; i < goodOrders100.length; i++) {
        try {
            const output = await processOrder(goodOrders100[i]);
            if (output) {
                fs.writeFileSync(`./prompts/good_order_${goodOrders100[i]}.txt`, output.prompt + output.completion);
                fineTune.push(output);
            }
        } catch (err) {
            console.error(err);
            console.log(`Error processing order ${goodOrders100[i]}`);
        }
    }

    fs.writeFileSync('./fine_tune_data.jsonl', fineTune.reduce((acc, item) => { return `${acc}\n${JSON.stringify(item)}`; }, ''));
    process.exit(0);
};

runner();
