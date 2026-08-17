'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/SessionProvider';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { EscrowStats } from '@/components/profile/escrow-stats';
import { InventoryGrid } from '@/components/profile/inventory-grid';
import {
  Crown, Shield, UserCheck, Wallet,
  User, Scroll,
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

const BILLING_HISTORY = [
  { id: '1', label: '空调维修服务', amount: 120, status: 'settled', date: '2026-07-08' },
  { id: '2', label: '厨房水池疏通', amount: 200, status: 'held', date: '2026-07-07' },
  { id: '3', label: '马桶疏通', amount: 80, status: 'settled', date: '2026-07-06' },
  { id: '4', label: '电路检修更换开关', amount: 150, status: 'held', date: '2026-07-05' },
  { id: '5', label: '热水器维修保养', amount: 350, status: 'settled', date: '2026-07-04' },
];

const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  held: { label: '托管中', dot: 'bg-indigo-500' },
  settled: { label: '已结算', dot: 'bg-emerald-500' },
};

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
      toast.error('加载个人信息失败');
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
      toast.success('个人信息已更新');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有密码字段');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码长度至少为6位');
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
      toast.success('密码已修改');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setChangingPassword(false);
    }
  };

  if (status || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mx-auto mb-8 h-40 w-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-zinc-800" />
        <div className="grid gap-6">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase">
              <Scroll className="w-4 h-4" /> Guild Adventurer Board
            </div>
            <h1 className="text-2xl font-black text-white mt-1">公会个人中心</h1>
          </div>
          <ThemeSwitcher />
        </div>

        {/* Player Banner & EXP Bar */}
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-300">
                  <User className="w-8 h-8" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black">
                Lv.42
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  {profile.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/40">
                  {roleLabels.join(' + ') || 'ADVENTURER'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                UID: {profile.id.substring(0, 10)}<wbr />...{profile.id.slice(-6)}
              </p>
            </div>
          </div>

          {/* Credit Score + EXP */}
          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> 信誉积分
              </span>
              <span className="text-amber-400 font-bold">{profile.credit_score} / 300</span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((profile.credit_score / 300) * 100, 100)}%` }}
                transition={{ duration: 1 }}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>EXP 经验值</span>
              <span className="text-cyan-400">4200 / 5000</span>
            </div>
          </div>
        </div>

        {/* Escrow Battle Report */}
        <EscrowStats balance={profile.balance} trustTier={4} />

        {/* Verification Status */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">认证状态</CardTitle>
            <CardDescription className="text-slate-400">全部认证已完成，享受最高信用额度</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {VERIFICATION_ITEMS.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/10 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/30">
                  <item.icon className="size-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                  <p className="text-xs text-emerald-400">已认证</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Inventory (Gacha Backpack) */}
        <InventoryGrid />

        {/* Billing History */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">资金流水</CardTitle>
            <CardDescription className="text-slate-400">最近 5 笔交易记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {BILLING_HISTORY.map((bill, i) => {
              const st = STATUS_STYLES[bill.status] ?? { label: bill.status, dot: 'bg-slate-400' };
              return (
                <div key={bill.id}>
                  {i > 0 && <div className="my-1 border-t border-slate-800" />}
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="truncate text-sm font-medium text-slate-100">{bill.label}</p>
                      <p className="text-xs text-slate-500">{bill.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-slate-100 tabular-nums">
                        ¥{bill.amount}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
                        <span className="text-xs text-slate-400">{st.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">个人信息</CardTitle>
            <CardDescription className="text-slate-400">修改您的姓名和联系方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">姓名</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" className="border-slate-700 bg-slate-950 text-slate-100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">邮箱</label>
                <Input value={profile.email} disabled className="border-slate-700 bg-slate-950 text-slate-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">手机号</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" className="border-slate-700 bg-slate-950 text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0">
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Provider Section */}
        {isProvider && (
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base text-slate-100">服务商信息</CardTitle>
              <CardDescription className="text-slate-400">管理您的服务简介、技能标签和服务区域</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">个人简介</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="简单介绍您的服务经验..."
                  className="flex min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">技能标签</label>
                  <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="如: 维修, 安装, 清洁 (用逗号分隔)" className="border-slate-700 bg-slate-950 text-slate-100" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">服务区域</label>
                  <Input value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="如: 三里屯, 望京, 国贸" className="border-slate-700 bg-slate-950 text-slate-100" />
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
                  if (res.ok) toast.success('服务商信息已更新');
                  else {
                    const err = await res.json();
                    toast.error(err.error || '保存失败');
                  }
                }} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0">
                  保存服务商信息
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Password */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">修改密码</CardTitle>
            <CardDescription className="text-slate-400">密码长度至少为6位</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">当前密码</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="输入当前密码" className="border-slate-700 bg-slate-950 text-slate-100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">新密码</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="输入新密码" className="border-slate-700 bg-slate-950 text-slate-100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">确认新密码</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" className="border-slate-700 bg-slate-950 text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={changingPassword} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                {changingPassword ? '修改中...' : '修改密码'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
