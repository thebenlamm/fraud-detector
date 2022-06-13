const mysql = require('mysql2'),
      format = require('date-fns/format'),
      faker = require('faker'),
      util = require('util');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Admin123!',
    database: 'cardcash'
});

const query = util.promisify(connection.query).bind(connection);

process.on('exit', () => {
    console.log('Closing connection');
    connection.end();
});

exports.getOrderInfo = async (orderId) => {
    const ORDER_INFO = `SELECT
    customer_id, date_purchased, name, street, city, state, zip, phone, email, shipping_module_code, merchant_id,
    merchant_value, total_cards, payment_method, user_agent, dispute_stage, cp_status, r_status, order_status
  FROM 
    orders o WHERE order_id = ?`;
    const orderInfo = await query(ORDER_INFO, orderId);
    if (orderInfo.length === 0) return null;
    const fakename = `${faker.name.firstName()} ${faker.name.lastName()}`;
    return {
        customerName: fakename, // orderInfo[0].name,
        customerId: orderInfo[0].customer_id,
        customerAddress: faker.address.streetAddress() + ' ' + faker.address.city() + ' ' + faker.address.stateAbbr() + ' ' + faker.address.zipCode(), // `${orderInfo[0].street} ${orderInfo[0].city}, ${orderInfo[0].state} ${orderInfo[0].zip}`,
        customerPhone: faker.phone.phoneNumber(), // orderInfo[0].phone,
        customerEmail: `${fakename.replace(' ', '.')}@gmail.com`, // orderInfo[0].email,
        deliveryType: orderInfo[0].shipping_module_code === 'digital' ? 'digital' : 'physical',
        disputeStage: orderInfo[0].dispute_stage,
        cardprober: orderInfo[0].cp_status === 'SAFE',
        riskified: orderInfo[0].r_status === 'approved',
        orderTotal: orderInfo.reduce((acc, item) => acc + item.merchant_value, 0),
        orderDate: new Date(orderInfo[0].date_purchased),
        paymentMethod: orderInfo[0].payment_method,
        userAgent: orderInfo[0].user_agent,
        chargeback: !!orderInfo[0].dispute_stage,
        declined: orderInfo[0].order_status === 'declined' && orderInfo[0].cp_status !== 'SAFE' && orderInfo[0].r_status !== 'approved',
        items: orderInfo.map(item => {
            return {
                productId: `${item.merchant_id}`,
                total: `$${item.merchant_value}`
            };
        })
    };
};

exports.getAccountAge = async (customerId, orderDate) => {
    try {
        const accountAgeResponse = await query('SELECT TIMESTAMPDIFF(DAY, first_dt, ?) AS account_age FROM first_dt WHERE customer_id = ?', [orderDate, customerId]);
        return accountAgeResponse[0].account_age;
    } catch (err) {
        console.log(err);
        return null;
    }
};

exports.getCustomerHistory = async (customerId, orderId) => {
    const ORDER_HISTORY = `SELECT date(ro.date_purchased) date, ro.order_total total
    FROM raw_orders_new ro
    INNER JOIN raw_orders_new roc ON roc.orders_id = ?
    WHERE ro.customer_id = ? AND ro.date_purchased < roc.date_purchased`;
    const customerHistory = await query(ORDER_HISTORY, [orderId, customerId]);
    return customerHistory.map(item => {
        return [format(item.date, 'yyyy-MM-dd'), `$${item.total}`];
    });
};
