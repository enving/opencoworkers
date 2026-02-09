import { User, Plus } from 'lucide-react';

export function PersonaEditor() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <User size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-zinc-100">Agent Personas</h3>
                        <p className="text-xs text-zinc-500">Define personalities and capabilities for your agents.</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-zinc-700">
                    <Plus size={14} />
                    New Persona
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mock Personas */}
                {['Senior React Dev', 'Python Data Scientist'].map(role => (
                    <div key={role} className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-purple-500/30 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-zinc-200 group-hover:text-purple-300 transition-colors">{role}</h4>
                            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">System</span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500 line-clamp-2">
                            Expert in {role.includes('React') ? 'modern frontend stack, Tailwind, and Hooks' : 'Pandas, NumPy, and statistical analysis'}.
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
