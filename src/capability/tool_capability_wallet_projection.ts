import type { Session, Treasury } from '../contracts/species.ts'
import { request } from './tool_capability_species_request.ts'
export type Connection = {
  configured: boolean
  gateway_url: string
  binding_id?: string
  appliance_symbol?: string
  message: string
}
export const readConnection = () => request<Connection>('/connection')
export const readTreasury = (session: Session) => request<Treasury>('/treasury', session)
