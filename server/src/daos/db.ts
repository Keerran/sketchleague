import pg_promise from "pg-promise";
const pgp = pg_promise()
pgp.pg.defaults.ssl = {
    rejectUnauthorized: false
}
export default pgp(process.env.DATABASE_URL!)
