import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Save, X, Trash2, Settings, Download } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

interface AgentEntry {
  id: number;
  agent_name: string;
  demo_ready: string;
  internal_owners: string;
  estimated_timeline: string;
  dependencies: string;
  created_at?: string;
  [key: string]: any;
}
interface ColumnConfig {
  id?: number;
  table_name: string;
  column_key: string;
  column_name: string;
  column_type: string;
  column_order?: number;
  created_at?: string;
}

const supabaseUrl = 'https://deaoaqbncddlskgylboq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlYW9hcWJuY2RkbHNrZ3lsYm9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwODgyMjgsImV4cCI6MjA2ODY2NDIyOH0.V_eCBJ05V8NU8GJlI-2EX_KgUa9wFA6naktPKG0WhNU';
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_NAME = 'agents';
const COLUMN_CONFIG_TABLE = 'column_configs';

function dedupeColumns(cols: ColumnConfig[]): ColumnConfig[] {
  const seen = new Set<string>();
  return cols.filter(c => {
    if (seen.has(c.column_key)) return false;
    seen.add(c.column_key);
    return true;
  });
}
function dedupeRows<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  return rows.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
function isAgentEntry(obj: any): obj is AgentEntry {
  return obj && typeof obj.agent_name === 'string' && typeof obj.demo_ready === 'string' && typeof obj.internal_owners === 'string';
}

const AgentTracker: React.FC = () => {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AgentEntry | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [headerEditValue, setHeaderEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newAgent, setNewAgent] = useState<Partial<AgentEntry>>({});
  // FILTERS
  const [agentNameFilter, setAgentNameFilter] = useState('');
  const [demoReadyFilter, setDemoReadyFilter] = useState('All');
  const [internalOwnerFilter, setInternalOwnerFilter] = useState('');

  useEffect(() => {
    const fetchColumnsAndAgents = async () => {
      let { data: colData } = await supabase
        .from(COLUMN_CONFIG_TABLE)
        .select('*')
        .eq('table_name', TABLE_NAME)
        .order('column_order', { ascending: true });

      let dedupedCols = dedupeColumns(colData || []);
      setColumns(dedupedCols);

      let { data: agentData } = await supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
      let dedupedAgents = dedupeRows((agentData || []).filter(isAgentEntry));
      setAgents(dedupedAgents);
    };
    fetchColumnsAndAgents();
  }, []);

  const refetchColumns = async () => {
    const { data: fetchedColumns } = await supabase
      .from(COLUMN_CONFIG_TABLE)
      .select('*')
      .eq('table_name', TABLE_NAME)
      .order('column_order', { ascending: true });
    setColumns(dedupeColumns(fetchedColumns as ColumnConfig[] || []));
  };
  const refetchAgents = async () => {
    const { data: fetched } = await supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
    setAgents(dedupeRows((fetched || []).filter(isAgentEntry)));
  };

  const handleEdit = (agent: AgentEntry) => {
    setEditingId(agent.id);
    setEditForm({ ...agent });
  };
  const handleSave = async () => {
    if (editForm) {
      await supabase.from(TABLE_NAME).update(editForm).eq('id', editForm.id);
      setEditingId(null);
      setEditForm(null);
      refetchAgents();
    }
  };
  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleHeaderEdit = (columnKey: string, currentLabel: string) => {
    setEditingHeader(columnKey);
    setHeaderEditValue(currentLabel);
  };
  const handleHeaderSave = async (columnKey: string) => {
    await supabase
      .from(COLUMN_CONFIG_TABLE)
      .update({ column_name: headerEditValue })
      .eq('column_key', columnKey)
      .eq('table_name', TABLE_NAME);
    setEditingHeader(null);
    setHeaderEditValue('');
    refetchColumns();
  };
  const handleHeaderDelete = async (columnKey: string) => {
    if (window.confirm('Are you sure you want to delete this column?')) {
      await supabase.from(COLUMN_CONFIG_TABLE).delete().eq('column_key', columnKey).eq('table_name', TABLE_NAME);
      for (const agent of agents) {
        const updatedAgent = { ...agent };
        delete updatedAgent[columnKey];
        await supabase.from(TABLE_NAME).update(updatedAgent).eq('id', agent.id);
      }
      refetchColumns();
      refetchAgents();
    }
  };

  const handleAddColumn = async () => {
    if (newColumnName.trim()) {
      const newColumn: ColumnConfig = {
        table_name: TABLE_NAME,
        column_key: newColumnName.toLowerCase().replace(/\s+/g, '_'),
        column_name: newColumnName,
        column_type: 'text',
        column_order: columns.length + 1,
      };
      await supabase.from(COLUMN_CONFIG_TABLE).insert(newColumn);
      for (const agent of agents) {
        await supabase.from(TABLE_NAME).update({ [newColumn.column_key]: '' }).eq('id', agent.id);
      }
      setNewColumnName('');
      setShowAddColumnForm(false);
      refetchColumns();
      refetchAgents();
    }
  };

  const handleAddAgent = async () => {
    const agent: AgentEntry = columns.reduce(
      (acc, col) => ({
        ...acc,
        [col.column_key]: newAgent[col.column_key] ?? '',
      }),
      { id: Date.now() } as AgentEntry
    );
    await supabase.from(TABLE_NAME).insert(agent);
    setNewAgent({});
    setShowAddForm(false);
    refetchAgents();
  };

  

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(agents.map(agent =>
      columns.reduce((acc, col) => ({ ...acc, [col.column_name]: agent[col.column_key] }), {})));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Agents');
    XLSX.writeFile(workbook, 'agents.xlsx');
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await supabase.from(TABLE_NAME).delete().eq('id', agentId);
      refetchAgents();
    }
  };

  // FILTERED DATA
  const filteredAgents = agents.filter(agent => {
    if (agentNameFilter && !agent.agent_name.toLowerCase().includes(agentNameFilter.toLowerCase())) return false;
    if (demoReadyFilter !== 'All' && agent.demo_ready !== demoReadyFilter) return false;
    if (internalOwnerFilter && !agent.internal_owners.toLowerCase().includes(internalOwnerFilter.toLowerCase())) return false;
    return true;
  });

  if (columns.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading table structure...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Agent Readiness & Deployment Tracker</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Agent
          </button>
          <button
            onClick={handleExportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Download as Excel
          </button>
         
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 px-4 py-2 rounded">
        <input
          type="text"
          placeholder="Agent Name"
          value={agentNameFilter}
          onChange={e => setAgentNameFilter(e.target.value)}
          className="border p-2 rounded"
          style={{ minWidth: 120 }}
        />
        <select
          value={demoReadyFilter}
          onChange={e => setDemoReadyFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="All">Demo Ready? All</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>
        <input
          type="text"
          placeholder="Internal Owner(s)"
          value={internalOwnerFilter}
          onChange={e => setInternalOwnerFilter(e.target.value)}
          className="border p-2 rounded"
          style={{ minWidth: 140 }}
        />
      </div>

      {/* Add Agent Form */}
      {showAddForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-semibold mb-2">Add Agent</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {columns.map(col => (
              <input
                key={col.column_key}
                type="text"
                value={newAgent[col.column_key] || ''}
                onChange={e => setNewAgent({ ...newAgent, [col.column_key]: e.target.value })}
                placeholder={col.column_name}
                className="border p-2 rounded"
              />
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleAddAgent} className="bg-green-600 text-white px-4 py-2 rounded">Add</button>
            <button onClick={() => setShowAddForm(false)} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}

      {/* Add Column Form */}
      {showAddColumnForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-semibold mb-2">Add Column</h3>
          <input
            type="text"
            value={newColumnName}
            onChange={e => setNewColumnName(e.target.value)}
            placeholder="Column Name"
            className="border p-2 rounded"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleAddColumn} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
            <button onClick={() => setShowAddColumnForm(false)} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded shadow">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold">Agent Entries</h3>
          <button
            onClick={() => setShowAddColumnForm(true)}
            className="bg-gray-600 text-white px-2 py-1 rounded flex items-center gap-1"
            title="Add Column"
          >
            <Settings className="w-4 h-4" />
            Add Column
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.column_key} className="px-3 py-2 text-left">
                    {editingHeader === col.column_key ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={headerEditValue}
                          onChange={e => setHeaderEditValue(e.target.value)}
                          className="border p-1 rounded"
                          onKeyPress={e => e.key === 'Enter' && handleHeaderSave(col.column_key)}
                        />
                        <button onClick={() => handleHeaderSave(col.column_key)} className="text-green-600"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditingHeader(null)} className="text-red-600"><X className="w-4 h-4" /></button>
                        <button onClick={() => handleHeaderDelete(col.column_key)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer"
                        onClick={() => handleHeaderEdit(col.column_key, col.column_name)}
                      >
                        {col.column_name}
                      </span>
                    )}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map(agent => (
                <tr key={agent.id}>
                  {columns.map(col => (
                    <td key={col.column_key} className="px-3 py-2">
                      {editingId === agent.id ? (
                        <input
                          type="text"
                          value={editForm?.[col.column_key] || ''}
                          onChange={e => setEditForm({ ...editForm!, [col.column_key]: e.target.value })}
                          className="border p-1 rounded"
                        />
                      ) : (
                        agent[col.column_key]
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right flex gap-2 justify-end">
                    {editingId === agent.id ? (
                      <>
                        <button onClick={handleSave} className="text-green-600"><Save className="w-4 h-4" /></button>
                        <button onClick={handleCancel} className="text-red-600"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(agent)} className="text-blue-600"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteAgent(agent.id)} className="text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentTracker;