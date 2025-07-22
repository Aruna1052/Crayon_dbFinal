import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Save, X, Trash2, Settings } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';


interface ClientEntry {
  id: number;
  client_name: string;
  agents_proposed: string;
  last_meeting: string;
  next_meeting: string;
  next_steps: string;
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

const TABLE_NAME = 'clients';
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
function isClientEntry(obj: any): obj is ClientEntry {
  return obj && typeof obj.client_name === 'string' && typeof obj.agents_proposed === 'string';
}

const ClientOverview: React.FC = () => {
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ClientEntry | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [headerEditValue, setHeaderEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newClient, setNewClient] = useState<Partial<ClientEntry>>({});
  // FILTERS
  const [filterClientName, setFilterClientName] = useState('');
  const [filterAgentsProposed, setFilterAgentsProposed] = useState('');

  useEffect(() => {
    const fetchColumnsAndClients = async () => {
      let { data: colData } = await supabase
        .from(COLUMN_CONFIG_TABLE)
        .select('*')
        .eq('table_name', TABLE_NAME)
        .order('column_order', { ascending: true });

      let dedupedCols = dedupeColumns(colData || []);
      setColumns(dedupedCols);

      let { data: clientData } = await supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
      let dedupedClients = dedupeRows((clientData || []).filter(isClientEntry));
      setClients(dedupedClients);
    };
    fetchColumnsAndClients();
  }, []);

  const refetchColumns = async () => {
    const { data: fetchedColumns } = await supabase
      .from(COLUMN_CONFIG_TABLE)
      .select('*')
      .eq('table_name', TABLE_NAME)
      .order('column_order', { ascending: true });
    setColumns(dedupeColumns(fetchedColumns as ColumnConfig[] || []));
  };
  const refetchClients = async () => {
    const { data: fetched } = await supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
    setClients(dedupeRows((fetched || []).filter(isClientEntry)));
  };

  const handleEdit = (client: ClientEntry) => {
    setEditingId(client.id);
    setEditForm({ ...client });
  };
  const handleSave = async () => {
    if (editForm) {
      await supabase.from(TABLE_NAME).update(editForm).eq('id', editForm.id);
      setEditingId(null);
      setEditForm(null);
      refetchClients();
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
      for (const client of clients) {
        const updatedClient = { ...client };
        delete updatedClient[columnKey];
        await supabase.from(TABLE_NAME).update(updatedClient).eq('id', client.id);
      }
      refetchColumns();
      refetchClients();
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
      for (const client of clients) {
        await supabase.from(TABLE_NAME).update({ [newColumn.column_key]: '' }).eq('id', client.id);
      }
      setNewColumnName('');
      setShowAddColumnForm(false);
      refetchColumns();
      refetchClients();
    }
  };

  const handleAddClient = async () => {
    const client: ClientEntry = columns.reduce(
      (acc, col) => ({
        ...acc,
        [col.column_key]: newClient[col.column_key] ?? '',
      }),
      { id: Date.now() } as ClientEntry
    );
    await supabase.from(TABLE_NAME).insert(client);
    setNewClient({});
    setShowAddForm(false);
    refetchClients();
  };

  

  const handleDeleteClient = async (clientId: number) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await supabase.from(TABLE_NAME).delete().eq('id', clientId);
      refetchClients();
    }
  };

  // FILTERED DATA
  const filteredClients = clients.filter(client => {
    if (filterClientName && !client.client_name.toLowerCase().includes(filterClientName.toLowerCase())) return false;
    if (filterAgentsProposed && !client.agents_proposed.toLowerCase().includes(filterAgentsProposed.toLowerCase())) return false;
    return true;
  });

  if (columns.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading table structure...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Client & Opportunity Overview</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
          </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 px-4 py-2 rounded">
        <input
          type="text"
          placeholder="Search Client Name"
          value={filterClientName}
          onChange={e => setFilterClientName(e.target.value)}
          className="border p-2 rounded"
          style={{ minWidth: 160 }}
        />
        <input
          type="text"
          placeholder="Search Agents Proposed"
          value={filterAgentsProposed}
          onChange={e => setFilterAgentsProposed(e.target.value)}
          className="border p-2 rounded"
          style={{ minWidth: 180 }}
        />
      </div>

      {/* Add Client Form */}
      {showAddForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-semibold mb-2">Add Client</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {columns.map(col => (
              (col.column_key === "last_meeting" || col.column_key === "next_meeting") ? (
                <input
                  key={col.column_key}
                  type="date"
                  value={newClient[col.column_key] || ''}
                  onChange={e => setNewClient({ ...newClient, [col.column_key]: e.target.value })}
                  placeholder={col.column_name}
                  className="border p-2 rounded"
                />
              ) : (
                <input
                  key={col.column_key}
                  type="text"
                  value={newClient[col.column_key] || ''}
                  onChange={e => setNewClient({ ...newClient, [col.column_key]: e.target.value })}
                  placeholder={col.column_name}
                  className="border p-2 rounded"
                />
              )
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleAddClient} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
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
          <h3 className="font-semibold">Client Entries</h3>
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
              {filteredClients.map(client => (
                <tr key={client.id}>
                  {columns.map(col => (
                    <td key={col.column_key} className="px-3 py-2">
                      {editingId === client.id ? (
                        (col.column_key === "last_meeting" || col.column_key === "next_meeting") ? (
                          <input
                            type="date"
                            value={editForm?.[col.column_key] || ''}
                            onChange={e => setEditForm({ ...editForm!, [col.column_key]: e.target.value })}
                            className="border p-1 rounded"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editForm?.[col.column_key] || ''}
                            onChange={e => setEditForm({ ...editForm!, [col.column_key]: e.target.value })}
                            className="border p-1 rounded"
                          />
                        )
                      ) : (
                        (col.column_key === "last_meeting" || col.column_key === "next_meeting")
                          ? (client[col.column_key]
                              ? new Date(client[col.column_key]).toLocaleDateString()
                              : "")
                          : client[col.column_key]
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right flex gap-2 justify-end">
                    {editingId === client.id ? (
                      <>
                        <button onClick={handleSave} className="text-green-600"><Save className="w-4 h-4" /></button>
                        <button onClick={handleCancel} className="text-red-600"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(client)} className="text-blue-600"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteClient(client.id)} className="text-red-600"><Trash2 className="w-3 h-3" /></button>
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

export default ClientOverview;