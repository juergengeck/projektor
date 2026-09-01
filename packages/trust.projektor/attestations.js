import {TypedAttestationService} from "../../../one/packages/trust.core/dist/services/TypedAttestationService.js";
import {ProjektorAttestationDefinitions} from "./attestation-definitions.js";

export function createProjektorAttestationService(dependencies) {
  return new TypedAttestationService(ProjektorAttestationDefinitions, dependencies);
}
