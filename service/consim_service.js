const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const service = require('./service_fn.js')
const moment = require('moment')
const app = express()
const port_service = 3001

app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '100mb'
}));

app.get('/get_master_template', logFunction, service.get_master_template)
app.get('/get_master_template_by_user', logFunction, service.get_master_template_by_user)
app.post('/upsert_master_config', logFunction, service.upsert_master_config)
app.post('/check_login', logFunction, service.check_login)
app.get('/get_master_config', logFunction, service.get_master_config)
app.post('/upsert_template_data', logFunction, service.upsert_template_data)
app.post('/upsert_config_template', logFunction, service.upsert_config_template)
app.get('/get_ctp_data', logFunction, service.get_ctp_data)
app.get('/delete_ctp_data', logFunction, service.delete_ctp_data)
app.post('/edit_ctp_data', logFunction, service.edit_ctp_data)
app.get('/get_usn_data', logFunction, service.get_usn_data)
app.post('/update_usn_template', logFunction, service.update_usn_template)
app.post('/delete_user_template', logFunction, service.delete_user_template)
app.get('/check_role', logFunction, service.check_role)

app.listen(port_service, () => {
    console.log("Start server with port " + port_service);
})

function logFunction(req, res, next) {
    console.log(moment().format("YYYY-MM-DD HH:mm:ss") + " :" + req.url)
    next()
}

