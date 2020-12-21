const pgcon = require('./newnode_pgconnection')
const config = require('./config')
const dbname = "mdc"
const moment = require('moment')
const jwt = require('jsonwebtoken');
const ActiveDirectory = require('activedirectory');
const secret_key = 'p&p}F)!lJH5E-^yu]rCY$zT2lB0F451,0p@/R>a|Xf0SGGkAd>x_J7}-%L+j.Iu'
const ad_config = {
    url: 'ldap://dtcserver.com',
    baseDN: 'DC=dtcserver,DC=com',
};
const ad = new ActiveDirectory(ad_config);

var checkActiveDirAuthen = (username, password) => {
    return new Promise((pass, fail) => {
        ad.authenticate(username + '@dtcserver.com', password, function (err, auth) {
            if (err) {
                console.log('ERROR: ' + JSON.stringify(err));
                return fail({ message: "password_not_correct" })
            }
            if (auth) {
                console.log('Authenticated!');
                pass(true)
            } else {
                console.log('Authentication failed!');
                pass(false)
            }

        });
    })
}

exports.check_login = async (req, res) => {
    try {
        let username = req.body['username']
        let password = req.body['password']
        let adCheck = await checkActiveDirAuthen(username, password)
        if (adCheck) {
            let sql1 = `SELECT COUNT(usn) FROM usr WHERE usn = '${username}'`
            let r1 = await pgcon.get(dbname, sql1, config.connectionString())
            if (r1.code) {
                res.send({ code: true, message: r1.error })
            } else {
                let usr_cnt = parseInt(r1.data[0].count)
                if (usr_cnt > 0) {
                    let updatesql = `UPDATE usr SET lst_lin = NOW() WHERE usn = '${username}'`
                    await pgcon.execute(dbname, updatesql, config.connectionString())
                    var token = jwt.sign(username, secret_key);
                    res.send({ code: false, token: token })
                } else {
                    let updatesql = `INSERT INTO usr(usn,lst_lin,role) VALUES ('${username}',NOW(),2) `
                    let r2 = await pgcon.execute(dbname, updatesql, config.connectionString())
                    if (r2.code) {
                        res.send({ code: true, message: r2.error })
                    } else {
                        var token = jwt.sign(username, secret_key);
                        res.send({ code: false, token: token })
                    }

                }
            }
        }
    } catch (error) {
        res.send({ code: true, message: error.message })
    }

}

exports.get_master_template_by_user = async (req, res) => {
    try {
        let username = req.query['username']
        let sql1 = `SELECT role FROM usr WHERE usn = '${username}' `
        let r1 = await pgcon.get(dbname, sql1, config.connectionString())
        if (r1.code) {
            console.log(`Error message1 : ${r1.message}`);
            res.send({ code: true, message: 'service_error' })
        } else if (r1.data.length == 0) {
            res.send({ code: true, message: 'no_user_data' })
        } else if (r1.data[0].role == '1') {
            let sql = `SELECT itmid , itm_th , itm_en , tyid , rqs , def , itm_dsc , itm_typ , itm_v FROM mct WHERE flg = '1' ORDER BY itmid`
            let r2 = await pgcon.get(dbname, sql, config.connectionString())
            if (r2.code) {
                console.log(`Error message1 : ${r2.message}`);
                res.send({ code: true, message: 'service_error' })
            } else {
                res.send({ code: false, data: r2.data })
            }
        } else {
            let sql2 = `SELECT mct.itmid , mct.itm_th , mct.itm_en , mct.tyid , mct.rqs , mct.def , mct.itm_dsc , mct.itm_typ , mct.itm_v
            FROM usr LEFT JOIN ctp ON usr.tpid = ctp.tpid LEFT JOIN mct ON ctp.itmid = mct.itmid 
            WHERE usr.usn = '${username}'`
            let r2 = await pgcon.get(dbname, sql2, config.connectionString())
            if (r2.code) {
                console.log(`Error message1 : ${r2.message}`);
                res.send({ code: true, message: 'service_error' })
            } else {
                res.send({ code: false, data: r2.data })
            }
        }
    } catch (error) {
        console.error(error.message);
        res.send({ code: true, message: 'service_error' })
    }
}


exports.get_master_template = async (req, res) => {
    let sql = `SELECT itmid , itm_th , itm_en , tyid , rqs , def , itm_dsc , itm_typ , itm_v FROM mct WHERE flg = '1' ORDER BY itmid`
    let r1 = await pgcon.get(dbname, sql, config.connectionString())
    if (r1.code) {
        console.log(`Error message1 : ${r1.message}`);
        res.send({ code: true, message: 'service_error' })
    } else {
        res.send({ code: false, data: r1.data })
    }
}


exports.upsert_master_config = async (req, res) => {
    let master_config_id = req.body['master_config_id']
    let data = req.body['data']
    let username = req.query['username']
    let sql1 = `SELECT * FROM mcf WHERE msid = '${master_config_id}'`
    let r1 = await pgcon.get(dbname, sql1, config.connectionString())
    if (r1.code) {
        console.log(`Error message : ${r1.message}`);
        res.send({ code: true, message: 'service_error' })
    } else {
        if (r1.data.length > 0) {
            //upsert old
            let all_data = []
            for (let item of data) {
                all_data.push([master_config_id, item.itmid, item.itm_v])
            }
            let insert_sql = `INSERT INTO msd(msid,itmid,itm_v) VALUES  ($1,$2,$3)`
            let update_sql = `UPDATE msd SET itm_v = $3 WHERE msid = $1 AND itmid = $2 `
            let r2 = await pgcon.upserttransaction(insert_sql, update_sql, all_data, dbname, config.connectionString())
            if (r2.code) {
                res.send({ code: true, message: 'service_error' })
            } else {
                addMasterConfigLogs(master_config_id, username, `Update master config ${master_config_id}`)
                res.send({ code: false })
            }
        } else {
            //insert new
            let sql3 = `SELECT COUNT(*) FROM mcf`
            let r3 = await pgcon.get(dbname, sql3, config.connectionString())
            if (r3.code) {
                res.send({ code: true, message: 'service_error' })
            } else {
                let last_id = parseInt(r3.data[0].count)
                last_id++
                master_config_id = last_id
                let insert_value = data.map(x => `('${master_config_id}','${x.itmid}','${x.itm_v}')`)
                let sql2 = `INSERT INTO msd(msid,itmid,itm_v) VALUES ${insert_value} ;INSERT INTO mcf(msid,lst,lst_c,usid,flg) VALUES ('${master_config_id}',NOW(),NOW(),'${username}','1');`
                let r2 = await pgcon.execute(dbname, sql2, config.connectionString())
                if (r2.code) {
                    console.log(`Error message : ${r2.message}`);
                    res.send({ code: true, message: 'service_error' })
                } else {
                    addMasterConfigLogs(master_config_id, username, `Add master config ${master_config_id}`)
                    res.send({ code: false })
                }
            }

        }
    }
}

var addMasterConfigLogs = async (msid, username, action) => {
    let sql = `INSERT INTO mch(msid,lst_c,usid,"desc") VALUES ('${msid}',NOW(),'${username}','${action}')`
    await pgcon.execute(dbname, sql, config.connectionString())
}

exports.get_master_config = async (req, res) => {
    try {
        let master_id = req.query['master_id']
        let username = req.query['username']
        let sql1 = `SELECT role FROM usr WHERE usn = '${username}' `
        let r1 = await pgcon.get(dbname, sql1, config.connectionString())
        if (r1.code) {
            console.log(`Error message1 : ${r1.message}`);
            res.send({ code: true, message: 'service_error' })
        } else if (r1.data.length == 0) {
            res.send({ code: true, message: 'no_user_data' })
        } else if (r1.data[0].role == '1') {
            let sql = `SELECT msid, mct.itmid , itm_th , itm_en , tyid , rqs , msd.itm_v as def , itm_dsc , itm_typ , mct.itm_v 
        FROM mct LEFT JOIN msd ON mct.itmid = msd.itmid WHERE msid = '${master_id}' ORDER BY mct.itmid`
            let r1 = await pgcon.get(dbname, sql, config.connectionString())
            if (r1.code) {
                res.send({ code: true, message: 'service_error' })
            } else {
                res.send({ code: false, data: r1.data })
            }
        } else {
            let sql2 = `SELECT mct.itmid,mct.itm_th, mct.itm_en,mct.tyid,mct.rqs,
            msd.itm_v as def, mct.itm_dsc, mct.itm_typ, mct.itm_v , msd.msid
            FROM usr LEFT JOIN ctp ON ctp.tpid = usr.tpid
            LEFT JOIN msd ON msd.itmid = ctp.itmid
            LEFT JOIN mct ON mct.itmid = msd.itmid
            WHERE usr.usn = '${username}' AND msd.msid = '${master_id}'`
            let r2 = await pgcon.get(dbname, sql2, config.connectionString())
            if (r2.code) {
                console.log(`Error message1 : ${r2.message}`);
                res.send({ code: true, message: 'service_error' })
            } else {
                res.send({ code: false, data: r2.data })
            }
        }

    } catch (error) {

    }

}

exports.upsert_template_data = async (req, res) => {
    let { itm_dsc, itm_en, itm_th, itm_typ, itm_v, rqs, tyid, def } = req.body
    let itmid = req.body['itmid']
    if (!itmid) {
        console.log(req.query['template_count']);
        itmid = 'itm-' + ('00000' + (parseInt(req.query['template_count']) + 1)).slice(-5)
    }
    if (itm_typ == '3') {
        def = def ? '1' : '0'
    }
    let insert_sql = `INSERT INTO mct(itmid,itm_th,itm_en,tyid,rqs,def,itm_dsc,itm_typ,itm_v,flg) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'1')`
    let update_sql = `UPDATE mct SET itm_th = $2 ,itm_en =$3 ,tyid = $4, rqs = $5 , def = $6, itm_dsc = $7 , itm_typ = $8 ,itm_v = $9
     WHERE itmid = $1`
    let data = [itmid, itm_th, itm_en, tyid, rqs ? '1' : '0', def, itm_dsc, itm_typ, itm_v]
    let r1 = await pgcon.upsertwithParams(dbname, insert_sql, update_sql, data, config.connectionString())
    if (r1.code) {
        res.send({ code: true, message: 'service_error' })
    } else {
        // addMasterConfigLogs(master_config_id, username, `Add/Edit template : ${itmid}`)
        res.send({ code: false })
    }
}

exports.upsert_config_template = async (req, res) => {
    let items = req.body['items']
    let username = req.query['username']
    let sql1 = `SELECT DISTINCT tpid FROM ctp ORDER BY tpid DESC`
    let r1 = await pgcon.get(dbname, sql1, config.connectionString())
    if (r1.code) {
        res.send({ code: true, message: 'service_error' })
    } else {
        let template_id = "tp-00001"
        if (r1.data.length > 0) {
            let temp_id = r1.data[0].tpid.split("-")[1]
            temp_id = parseInt(temp_id) + 1
            template_id = "tp-" + (("00000" + temp_id).slice(-5))
        }
        let sql2 = `DELETE FROM ctp WHERE tpid = '${template_id}'`
        let r2 = await pgcon.execute(dbname, sql2, config.connectionString())
        if (r2.code) {
            res.send({ code: true, message: 'service_error' })
        } else {
            let insert_sql = `INSERT INTO ctp(tpid,itmid,flg) VALUES ($1,$2,'1')`
            let insert_data = items.map(x => ([template_id, x]))
            let result = await pgcon.excuteParamsTransaction(insert_sql, insert_data, dbname, config.connectionString())
            if (result.code) {
                res.send({ code: true, message: 'service_error' })
            } else {
                addMasterConfigLogs(template_id, username, `Create template ${template_id}`)
                res.send({ code: false })
            }
        }
    }
}

exports.get_ctp_data = async (req, res) => {
    let value = req.query['value']
    let sql = `CREATE TEMP TABLE x ( itmid varchar, itm_th varchar, itm_en varchar );
    SELECT ctp.tpid, json_agg ( ( ctp.itmid, mct.itm_th, mct.itm_en ) :: x ) AS itmid FROM ctp 
    LEFT JOIN mct ON mct.itmid = ctp.itmid WHERE mct.flg = '1' GROUP BY	ctp.tpid ORDER BY ctp.tpid`
    if (value) {
        sql = `SELECT ctp.tpid , ctp.itmid , mct.itm_th , mct.itm_en  FROM ctp LEFT JOIN mct ON mct.itmid = ctp.itmid WHERE mct.flg = '1' AND ctp.tpid = '${value}'`
    }
    let r1 = await pgcon.get(dbname, sql, config.connectionString())
    if (r1.code) {
        console.log(r1.message);
        res.send({ code: true, message: 'service_error' })
    } else {
        res.send({ code: false, data: r1.data })
    }
}

exports.delete_ctp_data = async (req, res) => {
    let tpid = req.query['tpid']
    let username = req.query['username']
    let sql1 = `DELETE FROM ctp WHERE tpid = '${tpid}'`
    let r1 = await pgcon.execute(dbname, sql1, config.connectionString())
    if (r1.code) {
        res.send({ code: true, message: 'service_error' })
    } else {
        addMasterConfigLogs(tpid, username, `Delete template ${tpid}`)
        res.send({ code: false })
    }
}

exports.edit_ctp_data = async (req, res) => {
    let tpid = req.body['tpid']
    let items = req.body['items']
    let username = req.query['username']
    let insert_sql = `INSERT INTO ctp(tpid,itmid,flg) VALUES  ($1,$2,'1')`
    let update_sql = `UPDATE ctp SET flg = '1' WHERE tpid = $1 AND itmid = $2 `
    let all_data = items.map(x => ([tpid, x.itmid]))
    let r1 = await pgcon.upserttransaction(insert_sql, update_sql, all_data, dbname, config.connectionString())
    if (r1.code) {
        res.send({ code: true, message: 'service_error' })
    } else {
        addMasterConfigLogs(tpid, username, `Edit template ${tpid}`)
        res.send({ code: false })
    }
}

exports.get_usn_data = async (req, res) => {
    let sql1 = `SELECT usn , tpid , role , lst_lin FROM usr `
    let r1 = await pgcon.get(dbname, sql1, config.connectionString())
    if (r1.code) {
        console.log(r1.message);
        res.send({ code: true, message: 'service_error' })
    } else {
        res.send({ code: false, data: r1.data })
    }
}

exports.update_usn_template = async (req, res) => {
    let username = req.body['username']
    let tpid = req.body['tpid']
    let sql1 = `UPDATE usr SET tpid = '${tpid}' WHERE usn = '${username}'`
    let r1 = await pgcon.execute(dbname, sql1, config.connectionString())
    if (r1.code) {
        console.log(r1.message);
        res.send({ code: true, message: 'service_error' })
    } else {
        res.send({ code: false })
    }
}

exports.delete_user_template = async (req, res) => {
    let username = req.body['username']
    let sql1 = `UPDATE usr SET tpid = NULL WHERE usn = '${username}' `
    let r1 = await pgcon.execute(dbname, sql1, config.connectionString())
    if (r1.code) {
        console.log(r1.message);
        res.send({ code: true, message: 'service_error' })
    } else {
        res.send({ code: false })
    }
}

exports.check_role = async (req, res) => {
    try {
        let username = req.query['username']
        let sql1 = `SELECT role FROM usr WHERE usn = '${username}'`
        let r1 = await pgcon.get(dbname, sql1, config.connectionString())
        if (r1.code) {
            console.log(r1.message);
            res.send({ code: true, message: 'service_error' })
        } else {
            if (r1.data.length > 0) {
                res.send({ code: false, role: r1.data[0].role })
            } else {
                res.send({ code: false, role: "2" })
            }
        }
    } catch (error) {
        console.log(error.message);
        res.send({ code: true, message: 'service_error' })
    }
}