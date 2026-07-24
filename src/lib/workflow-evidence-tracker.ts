import { getServiceClient } from './supabase-client';
import crypto from 'crypto';

export interface WorkflowStageInput {
  contractId: string;
  userId: string;
  userIp?: string;
  stage: 'ACCEPTED' | 'DEPARTED' | 'ARRIVED' | 'IN_PROGRESS' | 'DONE';
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  clientDeviceSignature?: string;
}

export async function trackWorkflowStageEvidence(input: WorkflowStageInput) {
  const supabase = getServiceClient();

  if (input.stage === 'ARRIVED' && input.latitude && input.longitude) {
    console.log(`[Geo Checkin] 校验服务商到达坐标: [${input.longitude}, ${input.latitude}]`);
  }

  const rawPayload = JSON.stringify({
    stage: input.stage,
    userId: input.userId,
    userIp: input.userIp || '127.0.0.1',
    coords: input.latitude ? [input.longitude, input.latitude] : null,
    photoHash: input.photoUrl ? crypto.createHash('sha256').update(input.photoUrl).digest('hex') : null,
    timestamp: new Date().toISOString(),
  });

  const payloadHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

  const { data: lastEvidence } = await supabase
    .from('evidence_log')
    .select('hash')
    .eq('order_id', input.contractId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = (lastEvidence as { hash: string } | null)?.hash ?? 'GENESIS';

  const { error } = await supabase.from('evidence_log').insert({
    order_id: input.contractId,
    event_type: `STAGE_${input.stage}`,
    payload: rawPayload,
    hash: payloadHash,
    prev_hash: prevHash,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('Evidence log insert warning:', error.message);
  }

  return { success: true, stage: input.stage, payloadHash };
}
