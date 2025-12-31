'use client';

import {
    Gamepad2,
    TowerControl,
    Dice6,
    Bomb,
    Trophy,
    Skull,
    CircleDollarSign,
    Building2,
    CircleCheck,
    Volume2,
    VolumeX,
    Sun,
    Moon,
    Zap,
    Target,
    DollarSign,
    Lock,
    Twitter,
    MessageCircle,
    Sparkles,
    Frown,
    Flame,
    Rocket,
    ChevronDown,
    Play,
    Link,
    Medal,
    Wallet,
    type LucideIcon,
} from 'lucide-react';

// Re-export all icons for use in the app
export {
    Gamepad2,
    TowerControl,
    Dice6,
    Bomb,
    Trophy,
    Skull,
    CircleDollarSign,
    Building2,
    CircleCheck,
    Volume2,
    VolumeX,
    Sun,
    Moon,
    Zap,
    Target,
    DollarSign,
    Lock,
    Twitter,
    MessageCircle,
    Sparkles,
    Frown,
    Flame,
    Rocket,
    ChevronDown,
    Play,
    Link,
    Medal,
    Wallet,
    type LucideIcon,
};

// Icon wrapper with arcade neon glow styling
interface ArcadeIconProps {
    icon: LucideIcon;
    size?: number;
    color?: 'pink' | 'cyan' | 'green' | 'yellow' | 'white' | 'inherit';
    glow?: boolean;
    className?: string;
}

const colorMap = {
    pink: 'var(--neon-pink)',
    cyan: 'var(--neon-cyan)',
    green: 'var(--neon-green)',
    yellow: 'var(--neon-yellow)',
    white: 'var(--text-primary)',
    inherit: 'currentColor',
};

export function ArcadeIcon({
    icon: Icon,
    size = 24,
    color = 'inherit',
    glow = false,
    className = '',
}: ArcadeIconProps) {
    const iconColor = colorMap[color];
    const glowStyle = glow ? {
        filter: `drop-shadow(0 0 8px ${iconColor})`,
    } : {};

    return (
        <Icon
            size={size}
            style={{
                color: iconColor,
                ...glowStyle,
            }}
            className={className}
        />
    );
}
