import { NavLink } from 'react-router-dom';

interface HeaderProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export default function Header({ searchQuery, setSearchQuery }: HeaderProps) {
    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-10 py-3 shadow-sm z-10">
            <div className="flex items-center gap-8">
                <NavLink to="/" className="flex items-center gap-4 text-slate-900 dark:text-white hover:opacity-80 transition-opacity">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">monitoring</span>
                    </div>
                    <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                        CS Partner Journey
                    </h2>
                </NavLink>
                <label className="flex flex-col min-w-40 !h-10 max-w-64">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                        <div className="text-slate-500 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-lg border-r-0">
                            <span className="material-symbols-outlined text-[20px]">search</span>
                        </div>
                        <input
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-slate-100 dark:bg-slate-800 focus:border-none h-full placeholder:text-slate-500 px-4 rounded-l-none border-l-0 pl-2 text-sm font-normal leading-normal"
                            placeholder="Buscar parceiro..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </label>
            </div>
            <div className="flex flex-1 justify-end gap-8">
                <div className="hidden md:flex items-center gap-9">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            `text-sm font-medium leading-normal transition-colors ${isActive ? 'text-primary' : 'text-slate-500 hover:text-primary dark:text-slate-400'}`
                        }
                    >
                        Dashboard
                    </NavLink>
                    <button className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary transition-colors cursor-not-allowed">Parceiros</button>
                    <button className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary transition-colors cursor-not-allowed">Relatórios</button>
                    <NavLink
                        to="/configuracoes"
                        className={({ isActive }) =>
                            `text-sm font-medium leading-normal transition-colors ${isActive ? 'text-primary' : 'text-slate-500 hover:text-primary dark:text-slate-400'}`
                        }
                    >
                        Configurações
                    </NavLink>
                </div>
                <div
                    className="bg-center bg-no-repeat bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-700"
                    style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBkOOyx6Q7GzoywiwgRaTqEOG16xsykW5VLYZksEUpI9GnR3MDYM_yUcvfCvOmUSeDV4Noh-56UwMKnRkxCRWEXT8swPvysiQWQMz9nSKd5UJBdq2mustW1iw9amKrrBLX6sXIx7HEEzH-y8aBNTNb7giFaKkQpV_8_aQ63IcyUC3yA9nF7rtTTF58HMo6JdWWk7V-UPdyemaMQce-1msUvFSV3jr7618KPnoftFGzd0wuwm-Pb0CLTGTguGal6PMvA7z31SPnY0G0")' }}
                ></div>
            </div>
        </header>
    );
}
