import type {
  SoilClassificationRequest,
  SoilResultResponse,
} from '@services/soilClassificationContractService';

export interface SoilClassificationWorkspaceProps {
  initialRequest?: SoilClassificationRequest;
  onRequestChange?: (next: SoilClassificationRequest) => void;
  onResult?: (result: SoilResultResponse) => void;
}

export type SoilClassificationDraft = SoilClassificationRequest;
