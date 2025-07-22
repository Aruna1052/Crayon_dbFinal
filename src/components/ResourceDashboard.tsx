import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Save, X, Trash2, Settings , Download, MapPin } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

interface Resource {
  id: number;
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

const TABLE_NAME = 'resources';
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

const ResourceDashboard: React.FC = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Resource | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newResource, setNewResource] = useState<Partial<Resource>>({});
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [headerEditValue, setHeaderEditValue] = useState('');

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterStream, setFilterStream] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [searchProjects, setSearchProjects] = useState('');

  useEffect(() => {
    const fetchColumnsAndResources = async () => {
      let { data: colData } = await supabase
        .from(COLUMN_CONFIG_TABLE)
        .select('*')
        .eq('table_name', TABLE_NAME)
        .order('column_order', { ascending: true });

      let dedupedCols = dedupeColumns(colData || []);
      setColumns(dedupedCols);

      let { data: resourceData } = await supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
      let dedupedResources = dedupeRows((resourceData || []));
      setResources(dedupedResources);
    };
    fetchColumnsAndResources();
  }, []);

  const refetchColumns = async () => {
    const { data: fetchedColumns } = await supabase
      .from(COLUMN_CONFIG_TABLE)
      .select('*')
      .eq('table_name', TABLE_NAME)
      .order('column_order', { ascending: true });
    setColumns(dedupeColumns(fetchedColumns as ColumnConfig[] || []));
  };
  const refetchResources = async () => {
    const { data: fetched } = await supabase.from(TABLE_NAME).select('*').order('id', { ascending: true });
    let dedupedResources = dedupeRows((fetched || []));
    setResources(dedupedResources);
  };

  const handleEdit = (resource: Resource) => {
    setEditingId(resource.id);
    setEditForm({ ...resource });
  };
  const handleSave = async () => {
    if (editForm) {
      await supabase.from(TABLE_NAME).update(editForm).eq('id', editForm.id);
      setEditingId(null);
      setEditForm(null);
      refetchResources();
    }
  };
  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
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
      for (const resource of resources) {
        await supabase.from(TABLE_NAME).update({ [newColumn.column_key]: '' }).eq('id', resource.id);
      }
      setNewColumnName('');
      setShowAddColumnForm(false);
      refetchColumns();
      refetchResources();
    }
  };

  const handleAddResource = async () => {
    const resource: Resource = columns.reduce(
      (acc, col) => ({
        ...acc,
        [col.column_key]: newResource[col.column_key] ?? '',
      }),
      { id: Date.now() } as Resource
    );
    await supabase.from(TABLE_NAME).insert(resource);
    setNewResource({});
    setShowAddForm(false);
    refetchResources();
  };

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(resources.map(res =>
      columns.reduce((acc, col) => ({ ...acc, [col.column_name]: res[col.column_key] }), {})));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resources');
    XLSX.writeFile(workbook, 'resources.xlsx');
  };

  const toggleHighlight = async (resource: Resource) => {
    await supabase.from(TABLE_NAME).update({ is_highlighted: !resource.is_highlighted }).eq('id', resource.id);
    refetchResources();
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
      for (const resource of resources) {
        const updatedResource = { ...resource };
        delete updatedResource[columnKey];
        await supabase.from(TABLE_NAME).update(updatedResource).eq('id', resource.id);
      }
      refetchColumns();
      refetchResources();
    }
  };

  // DELETE ROW
  const handleDeleteResource = async (resourceId: number) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await supabase.from(TABLE_NAME).delete().eq('id', resourceId);
      refetchResources();
    }
  };

  // FILTERED DATA
  const streamOptions = Array.from(new Set(resources.map(r => r.stream).filter(Boolean))).sort();
  const roleOptions = Array.from(new Set(resources.map(r => r.role).filter(Boolean))).sort();

  const filteredResources = resources.filter(resource => {
    // Name filter
    if (searchName && !(resource.full_name || '').toLowerCase().includes(searchName.toLowerCase())) return false;
    // Stream filter
    if (filterStream && resource.stream !== filterStream) return false;
    // Role filter
    if (filterRole && resource.role !== filterRole) return false;
    // Projects filter
    if (searchProjects) {
      const projectCols = Object.keys(resource).filter(k => k.startsWith('project_'));
      const found = projectCols.some(
        k => (resource[k] || '').toLowerCase().includes(searchProjects.toLowerCase())
      );
      if (!found) return false;
    }
    return true;
  });

  if (columns.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading table structure...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Resource Allocation Dashboard</h2>
        <div className="flex gap-2">
          <button onClick={handleExportToExcel} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-1">
            <Download className="w-4 h-4" /> Download as Excel
          </button>
          <button onClick={() => setShowAddForm(true)} className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Resource
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 px-4 py-2 rounded">
        <input
          type="text"
          placeholder="Search by Name"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          className="border p-2 rounded"
          style={{ minWidth: 160 }}
        />
        <select
          value={filterStream}
          onChange={e => setFilterStream(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">All Streams</option>
          {streamOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">All Roles</option>
          {roleOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search Projects"
          value={searchProjects}
          onChange={e => setSearchProjects(e.target.value)}
          className="border p-2 rounded"
          style={{ minWidth: 160 }}
        />
      </div>

      {showAddForm && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-semibold mb-2">Add Resource</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {columns.map(col => (
              <input
                key={col.column_key}
                type="text"
                value={newResource[col.column_key] || ''}
                onChange={e => setNewResource({ ...newResource, [col.column_key]: e.target.value })}
                placeholder={col.column_name}
                className="border p-2 rounded"
              />
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleAddResource} className="bg-purple-600 text-white px-4 py-2 rounded">Add</button>
            <button onClick={() => setShowAddForm(false)} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}

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

      <div className="bg-white rounded shadow">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold">Resource Entries</h3>
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
              {filteredResources.map(resource => (
                <tr
                  key={resource.id}
                  className={resource.is_highlighted ? 'bg-yellow-100' : ''}
                  style={{ transition: 'background 0.3s' }}
                >
                  {columns.map(col => (
                    <td key={col.column_key} className="px-3 py-2">
                      {editingId === resource.id ? (
                        <input
                          type="text"
                          value={editForm?.[col.column_key] || ''}
                          onChange={e => setEditForm({ ...editForm!, [col.column_key]: e.target.value })}
                          className="border p-1 rounded"
                        />
                      ) : col.column_key === 'full_name' ? (
                        <span className="flex items-center gap-2">
                          <button
                            aria-label={resource.is_highlighted ? "Unmark as deployed" : "Mark as deployed"}
                            onClick={() => toggleHighlight(resource)}
                            title={resource.is_highlighted ? "Unmark as deployed" : "Mark as deployed"}
                            style={{ color: resource.is_highlighted ? "#ca8a04" : "#6b7280" }}
                            className="focus:outline-none"
                          >
                            <MapPin className="w-4 h-4" fill={resource.is_highlighted ? "#ca8a04" : "none"} />
                          </button>
                          {resource[col.column_key]}
                        </span>
                      ) : (
                        resource[col.column_key]
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right flex gap-2 justify-end">
                    {editingId === resource.id ? (
                      <>
                        <button onClick={handleSave} className="text-green-600"><Save className="w-4 h-4" /></button>
                        <button onClick={handleCancel} className="text-red-600"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(resource)} className="text-blue-600"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteResource(resource.id)} className="text-red-600"><Trash2 className="w-3 h-3" /></button>
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

export default ResourceDashboard;