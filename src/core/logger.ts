type Obj = Record<string, unknown>

function fmt(msgOrObj: string | Obj, msg?: string): string {
  if (typeof msgOrObj === 'string') return msgOrObj
  return msg ? `${msg} ${JSON.stringify(msgOrObj)}` : JSON.stringify(msgOrObj)
}

const logger = {
  info:  (msgOrObj: string | Obj, msg?: string) => console.log(fmt(msgOrObj, msg)),
  warn:  (msgOrObj: string | Obj, msg?: string) => console.warn(fmt(msgOrObj, msg)),
  error: (msgOrObj: string | Obj, msg?: string) => console.error(fmt(msgOrObj, msg)),
  debug: (msgOrObj: string | Obj, msg?: string) => { if (process.env.DEBUG) console.debug(fmt(msgOrObj, msg)) },
}

export default logger
