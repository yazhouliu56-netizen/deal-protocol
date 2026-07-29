/**
 * @file Domain Mirror Modules Registry (mM02 - mM13)
 * @module src/modules/mM02-mM13
 * @description
 * 架构澄清与领域镜像注册文件：
 * 1. 架构模式：本项目严格遵循 Next.js 模块化单体 (Modular Monolith) 规范。
 * 2. 活跃业务模块：所有真实的领域业务代码统一维护在 `src/modules/m02-auth` 至 `src/modules/m14-team-formation`。
 * 3. 镜像模块定位：本目录 (`mM02-mM13`) 仅作为未来服务拆分、微前端解耦或离线 SDK 导出的结构镜像占位点。
 */

export interface MirrorModuleMetadata {
  id: string;
  name: string;
  activePath: string;
  description: string;
  isMirrored: boolean;
}

export const MIRROR_MODULES_REGISTRY: Record<string, MirrorModuleMetadata> = {
  mM02: {
    id: 'mM02',
    name: 'Identity & Authentication',
    activePath: 'src/modules/m02-auth',
    description: '身份核验与实名认证模块',
    isMirrored: true,
  },
  mM03: {
    id: 'mM03',
    name: 'Category Config & Pricing',
    activePath: 'src/modules/m03-category-config',
    description: '品类配置与定价引擎',
    isMirrored: true,
  },
  mM04: {
    id: 'mM04',
    name: 'Protocol Generation',
    activePath: 'src/modules/m04-protocol-generation',
    description: '智能协议生成引擎',
    isMirrored: true,
  },
  mM05: {
    id: 'mM05',
    name: 'Geo Index Service',
    activePath: 'src/modules/m05-geo-index',
    description: 'PostGIS 空间检索服务',
    isMirrored: true,
  },
  mM06: {
    id: 'mM06',
    name: 'Matching & Routing',
    activePath: 'src/modules/m06-matching-routing',
    description: '需求与服务者撮合路由引擎',
    isMirrored: true,
  },
  mM07: {
    id: 'mM07',
    name: 'Credit & Reputation',
    activePath: 'src/modules/m07-credit',
    description: '双层信用与六维评分体系',
    isMirrored: true,
  },
  mM08: {
    id: 'mM08',
    name: 'Bandit Dispatcher',
    activePath: 'src/modules/m08-bandit',
    description: 'Contextual Bandit 物理隔离算法调度器',
    isMirrored: true,
  },
  mM09: {
    id: 'mM09',
    name: 'Content Audit & Precedents',
    activePath: 'src/modules/m09-content-audit',
    description: '内容安全审核与判例 RAG',
    isMirrored: true,
  },
  mM10: {
    id: 'mM10',
    name: 'SOS Emergency System',
    activePath: 'src/modules/m10-sos',
    description: '线下 SOS 紧急安全响应',
    isMirrored: true,
  },
  mM11: {
    id: 'mM11',
    name: 'Evidence Chain Log',
    activePath: 'src/modules/m11-evidence-log',
    description: 'SHA-256 追加不可改存证链',
    isMirrored: true,
  },
  mM12: {
    id: 'mM12',
    name: 'Realtime Push & Grab',
    activePath: 'src/modules/m12-push',
    description: '实时推送与抢单并发控制',
    isMirrored: true,
  },
  mM13: {
    id: 'mM13',
    name: 'Payment & Escrow Settlement',
    activePath: 'src/modules/m13-payment',
    description: '多渠道担保支付与分账清算',
    isMirrored: true,
  },
};

/**
 * 帮助函数：根据镜像模块 ID 获取对应的活跃模块信息
 */
export function getDomainModule(id: keyof typeof MIRROR_MODULES_REGISTRY): MirrorModuleMetadata {
  const moduleMeta = MIRROR_MODULES_REGISTRY[id];
  if (!moduleMeta) {
    throw new Error(`[Architecture Boundary Error] Unknown mirror module ID: ${id}`);
  }
  return moduleMeta;
}
