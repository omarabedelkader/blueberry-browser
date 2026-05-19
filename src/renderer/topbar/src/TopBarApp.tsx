import React from 'react'
import { BrowserProvider } from './contexts/BrowserContext'
import { TabBar } from './components/TabBar'
import { AddressBar } from './components/AddressBar'

export const TopBarApp: React.FC = () => {
    return (
        <BrowserProvider>
            <div className="flex flex-col bg-background select-none">
                {/* Tab Bar */}
                <div className="w-full h-10 px-2 pt-1 flex items-center app-region-drag bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(235,241,248,0.96))] dark:bg-[linear-gradient(180deg,rgba(18,23,31,0.98),rgba(14,18,26,0.98))]">
                    <TabBar />
                </div>

                {/* Toolbar */}
                <div className="flex items-center px-2 py-1 gap-2 app-region-drag bg-background shadow-subtle z-10 dark:shadow-[0_0_6px_rgba(0,0,0,0.2)]">
                    <AddressBar />
                </div>
            </div>
        </BrowserProvider>
    )
}
