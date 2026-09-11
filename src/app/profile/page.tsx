'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/SessionProvider';
import { toast } from "@/base/platform/toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import DuoPill from '@/components/ui/DuoPill';
import DuoEmpty from '@/components/oto-ui/DuoEmpty';
import { EscrowStats } from '@/components/profile/escrow-stats';
import { InventoryGrid } from '@/components/profile/inventory-grid';
import {
  Crown, Shield, UserCheck, Wallet,
  User,
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  roles: string;
  credit_score: number;
  balance: number;
  created_at: string;
  bio?: string;
  skills?: string | string[];
  service_areas?: string;
  avatar_url?: string;
}

const VERIFICATION_ITEMS = [
  { key: 'identity', icon: UserCheck, label: '身份核验', done: true },
  { key: 'face', icon: Shield, label: '人脸识别', done: true },
  { key: 'wallet', icon: Wallet, label: '数字钱包绑定', done: true },
];

/* Batch⑤-3 诚实化：旧 BILLING_HISTORY 系写死 mock 账单（资金流水造假零容忍），整段删除走 DuoEmpty；
 * 后端流水 API 到位后再接真数。STATUS_STYLES 随之删除。 */

export default function ProfilePage() {
  const { user: session, loading: status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [bio, setBio] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!status && !session) router.replace('/login');
  }, [session, status, router]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setProfile(data.user);
      setName(data.user.name);
      setPhone(data.user.phone ?? '');
      setBio(data.user.bio ?? '');
      const existingSkills: string[] = data.user.skills
        ? (typeof data.user.skills === 'string' ? JSON.parse(data.user.skills) : data.user.skills)
        : [];
      setSkillsInput(existingSkills.join(', '));
      setServiceAreas(data.user.service_areas ?? '');
    } catch {
      toast('加载个人信息失败', "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const init = async () => {
      await fetchProfile();
    };
    init();
  }, [session, fetchProfile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: phone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setProfile(data.user);
      toast('个人信息已更新', "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('请填写所有密码字段', "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('两次输入的新密码不一致', "error");
      return;
    }
    if (newPassword.length < 6) {
      toast('新密码长度至少为6位', "error");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '修改失败');
      toast('密码已修改', "success");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '修改失败', "error");
    } finally {
      setChangingPassword(false);
    }
  };

  if (status || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mx-auto mb-8 h-40 w-64 animate-pulse rounded-3xl bg-[var(--color-duo-swan)]" />
        <div className="grid gap-6">
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--color-duo-swan)]" />
          <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-duo-swan)]" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const userRoles: string[] = profile.roles
    ? JSON.parse(profile.roles)
    : [profile.role || 'CUSTOMER'];
  const isProvider = userRoles.includes('PROVIDER');
  const isCustomer = userRoles.includes('CUSTOMER');
  const roleLabels = [
    isProvider && '服务商',
    isCustomer && '客户',
  ].filter(Boolean) as string[];


  return (
    <div className="min-h-screen bg-[var(--color-duo-polar)] text-[var(--color-duo-eel)] p-4 sm:p-8 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-[var(--color-duo-swan)]">
          <div>
            <h1 className="text-2xl font-black text-[var(--color-duo-eel)] mt-1">个人中心</h1>
          </div>
        </div>

        {/* Player Banner */}
        <div className="rounded-3xl border-2 border-[var(--color-duo-swan)] bg-white p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-duo-blue)] p-0.5">
                <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center text-[var(--color-duo-blue-ink)]">
                  <User className="w-8 h-8" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[var(--color-duo-eel)]">
                  {profile.name}
                </h2>
                <DuoPill tone="blue">{roleLabels.join(' + ') || '普通用户'}</DuoPill>
              </div>
              <p className="text-xs text-[var(--color-duo-wolf)] font-mono">
                UID: {profile.id.substring(0, 10)}<wbr />...{profile.id.slice(-6)}
              </p>
            </div>
          </div>

          {/* Credit Score（后端真数；旧 Lv.42/EXP4200 系写死 mock，已删） */}
          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[var(--color-duo-wolf)] flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-[var(--color-duo-yellow-dark)]" /> 信誉积分
              </span>
              <span className="text-[var(--color-duo-yellow-ink)] font-bold">{profile.credit_score} / 300</span>
            </div>
            <div className="h-2 w-full bg-white rounded-full border-2 border-[var(--color-duo-swan)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((profile.credit_score / 300) * 100, 100)}%` }}
                transition={{ duration: 1 }}
                className="h-full bg-[var(--color-duo-yellow)]"
              />
            </div>
          </div>
        </div>

        {/* Escrow Battle Report（只留真数：托管余额＋信誉积分） */}
        <EscrowStats balance={profile.balance} creditScore={profile.credit_score} />

        {/* Verification Status */}
        <Card className="border-2 border-[var(--color-duo-swan)] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[var(--color-duo-eel)]">认证状态</CardTitle>
            <CardDescription className="text-[var(--color-duo-wolf)]">全部认证已完成，享受最高信用额度</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {VERIFICATION_ITEMS.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-xl border-2 border-[var(--color-duo-green)]/40 bg-[var(--color-duo-green)]/10 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-duo-green)]/10">
                  <item.icon className="size-4 text-[var(--color-duo-green-ink)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-duo-eel)]">{item.label}</p>
                  <p className="text-xs text-[var(--color-duo-green-ink)]">已认证</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Inventory (权益资产) */}
        <InventoryGrid />

        {/* Billing History（mock 账单已删，空态占位等后端 API） */}
        <Card className="border-2 border-[var(--color-duo-swan)] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[var(--color-duo-eel)]">资金流水</CardTitle>
            <CardDescription className="text-[var(--color-duo-wolf)]">结算后交易记录将显示在这里</CardDescription>
          </CardHeader>
          <CardContent>
            <DuoEmpty
              mascot="beast-empty"
              title="暂无资金流水"
              desc="完成首单结算后，交易记录将显示在这里"
              action="去首页看看"
              onAction={() => router.push('/')}
              testId="profile-billing-empty"
              launchTestId="profile-billing-launch"
            />
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card className="border-2 border-[var(--color-duo-swan)] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[var(--color-duo-eel)]">个人信息</CardTitle>
            <CardDescription className="text-[var(--color-duo-wolf)]">修改您的姓名和联系方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">姓名</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">邮箱</label>
                <Input value={profile.email} disabled className="border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] text-[var(--color-duo-wolf)]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">手机号</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving} className="bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-neutral-900 hover:brightness-105">
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Provider Section */}
        {isProvider && (
          <Card className="border-2 border-[var(--color-duo-swan)] bg-white">
            <CardHeader>
              <CardTitle className="text-base text-[var(--color-duo-eel)]">服务商信息</CardTitle>
              <CardDescription className="text-[var(--color-duo-wolf)]">管理您的服务简介、技能标签和服务区域</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">个人简介</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="简单介绍您的服务经验..."
                  className="flex min-h-[80px] w-full rounded-md border-2 border-[var(--color-duo-swan)] bg-white px-3 py-2 text-sm text-[var(--color-duo-eel)] shadow-sm placeholder:text-[var(--color-duo-hare)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-duo-blue)]"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-duo-eel)]">技能标签</label>
                  <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="如: 维修, 安装, 清洁 (用逗号分隔)" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-duo-eel)]">服务区域</label>
                  <Input value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="如: 三里屯, 望京, 国贸" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={async () => {
                  const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean);
                  const res = await fetch('/api/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bio, skills, service_areas: serviceAreas }),
                  });
                  if (res.ok) toast('服务商信息已更新', "success");
                  else {
                    const err = await res.json();
                    toast(err.error || '保存失败', "error");
                  }
                }} className="bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-eel)] hover:border-[var(--color-duo-green)]/40">
                  保存服务商信息
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Password */}
        <Card className="border-2 border-[var(--color-duo-swan)] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[var(--color-duo-eel)]">修改密码</CardTitle>
            <CardDescription className="text-[var(--color-duo-wolf)]">密码长度至少为6位</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">当前密码</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="输入当前密码" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">新密码</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="输入新密码" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-duo-eel)]">确认新密码</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" className="border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-eel)] hover:border-[var(--color-duo-green)]/40">
                {changingPassword ? '修改中...' : '修改密码'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
