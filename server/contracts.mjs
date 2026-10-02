export class GatewayError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
export const refuse = (status, code, message) => { throw new GatewayError(status, code, message) }
