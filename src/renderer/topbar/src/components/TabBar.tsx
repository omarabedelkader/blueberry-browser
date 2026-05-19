import React from 'react'
import { Plus, X } from 'lucide-react'
import { useBrowser } from '../contexts/BrowserContext'
import { Favicon } from '../components/Favicon'
import { TabBarButton } from '../components/TabBarButton'
import { cn } from '@common/lib/utils'

interface TabItemProps {
    id: string
    title: string
    favicon?: string | null
    isActive: boolean
    colorIndex: number
    isPinned?: boolean
    onClose: () => void
    onActivate: () => void
}

const TAB_TINTS = [
    {
        idle: "bg-[rgba(244,114,182,0.10)] hover:bg-[rgba(244,114,182,0.16)] border-[rgba(244,114,182,0.18)]",
        active: "bg-[rgba(244,114,182,0.22)] border-[rgba(244,114,182,0.32)]",
    },
    {
        idle: "bg-[rgba(59,130,246,0.10)] hover:bg-[rgba(59,130,246,0.16)] border-[rgba(59,130,246,0.18)]",
        active: "bg-[rgba(59,130,246,0.22)] border-[rgba(59,130,246,0.32)]",
    },
    {
        idle: "bg-[rgba(16,185,129,0.10)] hover:bg-[rgba(16,185,129,0.16)] border-[rgba(16,185,129,0.18)]",
        active: "bg-[rgba(16,185,129,0.22)] border-[rgba(16,185,129,0.32)]",
    },
    {
        idle: "bg-[rgba(245,158,11,0.10)] hover:bg-[rgba(245,158,11,0.16)] border-[rgba(245,158,11,0.18)]",
        active: "bg-[rgba(245,158,11,0.22)] border-[rgba(245,158,11,0.32)]",
    },
    {
        idle: "bg-[rgba(168,85,247,0.10)] hover:bg-[rgba(168,85,247,0.16)] border-[rgba(168,85,247,0.18)]",
        active: "bg-[rgba(168,85,247,0.22)] border-[rgba(168,85,247,0.32)]",
    },
    {
        idle: "bg-[rgba(236,72,153,0.10)] hover:bg-[rgba(236,72,153,0.16)] border-[rgba(236,72,153,0.18)]",
        active: "bg-[rgba(236,72,153,0.22)] border-[rgba(236,72,153,0.32)]",
    },
]

const TabItem: React.FC<TabItemProps> = ({
    title,
    favicon,
    isActive,
    colorIndex,
    isPinned = false,
    onClose,
    onActivate
}) => {
    const tint = TAB_TINTS[colorIndex % TAB_TINTS.length]
    const baseClassName = cn(
        "relative flex items-center h-8 pl-2 pr-1.5 select-none rounded-xl border",
        "text-primary group/tab transition-all duration-200 cursor-pointer",
        "app-region-no-drag", // Make tabs clickable
        isActive
            ? cn("shadow-sm dark:shadow-none", tint.active)
            : cn("shadow-none", tint.idle),
        isPinned ? "w-8 !px-0 justify-center" : ""
    )

    return (
        <div className="py-1 px-1">
            <div
                className={baseClassName}
                onClick={() => !isActive && onActivate()}
            >
                {/* Favicon */}
                <div className={cn(!isPinned && "mr-2")}>
                    <Favicon src={favicon} />
                </div>

                {/* Title (hide for pinned tabs) */}
                {!isPinned && (
                    <span className="text-xs truncate max-w-[200px] flex-1">
                        {title || 'New Tab'}
                    </span>
                )}

                {/* Close button (shows on hover) */}
                {!isPinned && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                        }}
                        className={cn(
                            "flex-shrink-0 p-1 rounded-md transition-opacity",
                            "hover:bg-black/5 dark:hover:bg-white/10",
                            "opacity-0 group-hover/tab:opacity-100",
                            isActive && "opacity-100"
                        )}
                    >
                        <X className="size-3 text-primary dark:text-primary" />
                    </div>
                )}
            </div>
        </div>
    )
}

export const TabBar: React.FC = () => {
    const { tabs, createTab, closeTab, switchTab } = useBrowser()

    const handleCreateTab = () => {
        createTab('https://www.google.com')
    }

    // Extract favicon from URL (simplified - you might want to improve this)
    const getFavicon = (url: string) => {
        try {
            const domain = new URL(url).hostname
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } catch {
            return null
        }
    }

    return (
        <div className="flex-1 overflow-x-hidden flex items-center rounded-t-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(236,240,246,0.92),rgba(226,232,240,0.82))] px-2 dark:border-border/80 dark:bg-[linear-gradient(180deg,rgba(27,34,46,0.96),rgba(21,27,37,0.96))]">
            {/* macOS traffic lights spacing */}
            <div className="pl-20" />

            {/* Tabs */}
            <div className="flex-1 overflow-x-auto flex">
                {tabs.map((tab, index) => (
                    <TabItem
                        key={tab.id}
                        id={tab.id}
                        title={tab.title}
                        favicon={getFavicon(tab.url)}
                        isActive={tab.isActive}
                        colorIndex={index}
                        onClose={() => closeTab(tab.id)}
                        onActivate={() => switchTab(tab.id)}
                    />
                ))}
            </div>

            {/* Add Tab Button */}
            <div className="pl-1 pr-2">
                <TabBarButton
                    Icon={Plus}
                    onClick={handleCreateTab}
                />
            </div>
        </div>
    )
}
