import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { UserCircleIcon } from '../icons/UserCircleIcon';
import { HomeIcon } from '../icons/HomeIcon';
import { ArrowTrendingUpIcon } from '../icons/ArrowTrendingUpIcon';
import { AcademicCapIcon } from '../icons/AcademicCapIcon';
import { ChatBubbleIcon } from '../icons/ChatBubbleIcon';
import { NewspaperIcon } from '../icons/NewspaperIcon';

const NavItem = ({ to, icon, label, isMobile = false }: { to: string; icon: React.ReactNode; label: string; isMobile?: boolean }) => {
    const baseClasses = "flex items-center justify-center transition-colors duration-200 rounded-md";
    const activeClass = 'bg-secondary text-foreground';
    const inactiveClass = 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground';

    if (isMobile) {
        return (
             <NavLink
                to={to}
                className={({ isActive }) =>
                    `${baseClasses} flex-col w-full h-16 ${isActive ? activeClass : inactiveClass}`
                }
            >
                {icon}
                <span className="mt-1 text-xs">{label}</span>
            </NavLink>
        )
    }

    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `${baseClasses} px-3 py-2 text-sm font-medium ${isActive ? activeClass : inactiveClass}`
            }
        >
            {icon}
            <span className="ml-2">{label}</span>
        </NavLink>
    );
};

export const Header: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser } = state;

    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                        HoloTrade
                    </Link>
                    {/* Desktop Nav */}
                    <div className="hidden sm:flex items-center space-x-2">
                        <NavItem to="/" icon={<HomeIcon className="w-5 h-5"/>} label="Dashboard" />
                        <NavItem to="/trade" icon={<ArrowTrendingUpIcon className="w-5 h-5"/>} label="Trade" />
                        <NavItem to="/news" icon={<NewspaperIcon className="w-5 h-5"/>} label="News" />
                        <NavItem to="/learn" icon={<AcademicCapIcon className="w-5 h-5"/>} label="Learn" />
                        <NavItem to="/demo" icon={<span className="text-base">▶</span>} label="Demo" />
                    </div>

                    <div className="flex items-center space-x-2">
                        <UserCircleIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-sm font-medium">{currentUser?.name}</span>
                    </div>
                </nav>
            </header>
            {/* Mobile Nav */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border grid grid-cols-5 gap-1 p-1 z-50">
                <NavItem to="/" icon={<HomeIcon className="w-6 h-6"/>} label="Home" isMobile />
                <NavItem to="/trade" icon={<ArrowTrendingUpIcon className="w-6 h-6"/>} label="Trade" isMobile />
                <NavItem to="/news" icon={<NewspaperIcon className="w-6 h-6"/>} label="News" isMobile />
                <NavItem to="/learn" icon={<AcademicCapIcon className="w-6 h-6"/>} label="Learn" isMobile />
                <NavItem to="/demo" icon={<span className="text-xl">▶</span>} label="Demo" isMobile />
            </div>
        </>
    );
};
