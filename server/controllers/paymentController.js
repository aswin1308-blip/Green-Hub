const payment = async (req, res) => {

    res.json({
        success: true,
        message: "Payment API Ready"
    });

}

module.exports = { payment };