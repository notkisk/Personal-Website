import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, CheckCircle, AlertCircle, Code, MessageSquare, Play, Loader2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface Column {
  name: string;
  type: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: string;
}

interface Table {
  columns: Column[];
  data: Record<string, unknown>[];
}

interface Schema {
  [tableName: string]: Table;
}

interface Message {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: Date;
  isSQL?: boolean;
  result?: Record<string, unknown>[];
  error?: string;
  success?: boolean;
}

interface ChatInterfaceProps {
  onSchemaChange: (schema: Schema) => void;
  schema: Schema;
}

const mockDatabase: Schema = {
  users: {
    columns: [
      { name: 'id', type: 'INTEGER', isPrimary: true },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'name', type: 'VARCHAR(100)' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
    data: [
      { id: 1, email: 'john@example.com', name: 'John Doe', created_at: '2024-01-15 10:30:00' },
      { id: 2, email: 'jane@example.com', name: 'Jane Smith', created_at: '2024-01-16 14:20:00' },
    ]
  },
  orders: {
    columns: [
      { name: 'id', type: 'INTEGER', isPrimary: true },
      { name: 'user_id', type: 'INTEGER', isForeign: true, references: 'users.id' },
      { name: 'total', type: 'DECIMAL(10,2)' },
      { name: 'status', type: 'VARCHAR(50)' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
    data: [
      { id: 101, user_id: 1, total: 299.99, status: 'completed', created_at: '2024-01-18 16:45:00' },
      { id: 102, user_id: 2, total: 149.50, status: 'pending', created_at: '2024-01-19 11:30:00' },
    ]
  }
};

const executeSQL = (sql: string, onSchemaChange: (schema: Schema) => void): { success: boolean; error?: string; result?: Record<string, unknown>[] } => {
  const cleanSQL = sql.trim().toLowerCase();

  try {
    if (cleanSQL.startsWith('create table')) {
      const match = sql.match(/create table\s+(\w+)\s*\((.*)\)/ims);
      if (match) {
        const tableName = match[1];
        const columnsStr = match[2];
        const columns: Column[] = columnsStr.split(',').map(col => {
          const parts = col.trim().split(/\s+/);
          const name = parts[0].replace(/[`"']/g, '');
          const type = parts[1] || 'VARCHAR(255)';
          const isPrimary = col.toUpperCase().includes('PRIMARY KEY');
          const isForeign = col.toUpperCase().includes('REFERENCES');
          let references = '';
          if (isForeign) {
            const refMatch = col.match(/REFERENCES\s+(\w+)\s*\(([^)]+)\)/i);
            if (refMatch) {
              references = `${refMatch[1]}.${refMatch[2].replace(/[`"']/g, '')}`;
            }
          }
          return { name, type, isPrimary, isForeign, references };
        });
        mockDatabase[tableName] = { columns, data: [] };
        onSchemaChange({ ...mockDatabase });
        return { success: true, result: [{ message: `Table '${tableName}' created successfully` }] };
      }
      return { success: false, error: 'Invalid CREATE TABLE syntax' };
    }

    if (cleanSQL.startsWith('drop table')) {
      const match = sql.match(/drop table\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        if (mockDatabase[tableName]) {
          delete mockDatabase[tableName];
          onSchemaChange({ ...mockDatabase });
          return { success: true, result: [{ message: `Table '${tableName}' dropped successfully` }] };
        } else {
          return { success: false, error: `Table '${tableName}' does not exist` };
        }
      }
      return { success: false, error: 'Invalid DROP TABLE syntax' };
    }

    if (cleanSQL.startsWith('alter table')) {
      const match = sql.match(/alter table\s+(\w+)\s+add column\s+(\w+)\s+([^;]+)/i);
      if (match) {
        const tableName = match[1];
        const columnName = match[2];
        const columnType = match[3];
        if (mockDatabase[tableName]) {
          mockDatabase[tableName].columns.push({ name: columnName, type: columnType });
          onSchemaChange({ ...mockDatabase });
          return { success: true, result: [{ message: `Column '${columnName}' added to table '${tableName}'` }] };
        } else {
          return { success: false, error: `Table '${tableName}' does not exist` };
        }
      }
      return { success: false, error: 'Invalid ALTER TABLE syntax' };
    }

    if (cleanSQL.startsWith('select')) {
      const fromMatch = cleanSQL.match(/from\s+(\w+)/i);
      if (!fromMatch) return { success: false, error: 'Invalid SELECT statement: Missing FROM clause.' };
      const tableName = fromMatch[1];
      if (!mockDatabase[tableName]) return { success: false, error: `Table '${tableName}' not found.` };
      return { result: mockDatabase[tableName].data, success: true };
    }

    if (cleanSQL.startsWith('insert')) {
      const intoMatch = cleanSQL.match(/into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      if (!intoMatch) return { success: false, error: 'Invalid INSERT statement: Missing INTO clause.' };
      const tableName = intoMatch[1];
      const columns = intoMatch[2].split(',').map(col => col.trim());
      const values = intoMatch[3].split(',').map(val => val.trim());
      if (columns.length !== values.length) return { success: false, error: 'Invalid INSERT statement: Number of columns and values do not match.' };
      if (!mockDatabase[tableName]) return { success: false, error: `Table '${tableName}' not found.` };
      const newRow: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        newRow[col] = values[i];
      });
      mockDatabase[tableName].data.push(newRow);
      onSchemaChange({ ...mockDatabase });
      return { success: true, result: [{ message: `1 row inserted into ${tableName}.` }] };
    }

    if (cleanSQL.startsWith('update')) {
      const tableMatch = cleanSQL.match(/update\s+(\w+)\s+set\s+([^=]+)=([^;]+)/i);
      if (!tableMatch) return { success: false, error: 'Invalid UPDATE statement.' };
      const tableName = tableMatch[1];
      const column = tableMatch[2].trim();
      const value = tableMatch[3].trim();
      if (!mockDatabase[tableName]) return { success: false, error: `Table '${tableName}' not found.` };
      const rowCount = mockDatabase[tableName].data.length > 0 ? 1 : 0;
      if (rowCount > 0) {
        mockDatabase[tableName].data[0][column] = value;
        onSchemaChange({ ...mockDatabase });
      }
      return { success: true, result: [{ message: `${rowCount} row(s) updated in ${tableName}.` }] };
    }

    if (cleanSQL.startsWith('delete')) {
      const fromMatch = cleanSQL.match(/from\s+(\w+)/i);
      if (!fromMatch) return { success: false, error: 'Invalid DELETE statement: Missing FROM clause.' };
      const tableName = fromMatch[1];
      if (!mockDatabase[tableName]) return { success: false, error: `Table '${tableName}' not found.` };
      const rowCount = mockDatabase[tableName].data.length;
      mockDatabase[tableName].data = [];
      onSchemaChange({ ...mockDatabase });
      return { success: true, result: [{ message: `${rowCount} row(s) deleted from ${tableName}.` }] };
    }

    return { success: false, error: 'Invalid or unsupported SQL syntax' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown SQL execution error occurred';
    return { success: false, error: message };
  }
};

const generateSQLCode = (schema: Schema): string => {
  let sql = '';
  
  Object.keys(schema).forEach(tableName => {
    const table = schema[tableName];
    sql += `-- Create ${tableName} table\n`;
    sql += `CREATE TABLE ${tableName} (\n`;
    
    const columnDefs = table.columns.map((col: Column) => {
      let def = `  ${col.name} ${col.type}`;
      if (col.isPrimary) def += ' PRIMARY KEY';
      if (col.isForeign && col.references) {
        const [refTable, refCol] = col.references.split('.');
        def += ` REFERENCES ${refTable}(${refCol})`;
      }
      return def;
    });
    
    sql += columnDefs.join(',\n');
    sql += '\n);';

    if (table.data && table.data.length > 0) {
      sql += `\n\n-- Insert data into ${tableName}\n`;
      table.data.forEach(row => {
        const columns = Object.keys(row).join(', ');
        const values = Object.values(row).map(val => typeof val === 'string' ? `'${val}'` : val).join(', ');
        sql += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
      });
    }
    sql += '\n\n';
  });
  
  return sql;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSchemaChange, schema }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'SQL Database Management System initialized. Create tables, modify schema, and query data.',
      timestamp: new Date(),
      success: true,
    }
  ]);
  const [input, setInput] = useState('');
  const [codeInput, setCodeInput] = useState('SELECT * FROM users;');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCodeExecuting, setIsCodeExecuting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeQuery = async (query: string, from: 'chat' | 'code') => {
    if (!query.trim()) return;

    const setLoading = from === 'chat' ? setIsExecuting : setIsCodeExecuting;
    setLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date(),
      isSQL: true,
    };

    setMessages(prev => [...prev, userMessage]);

    setTimeout(() => {
      const { result, error, success } = executeSQL(query, onSchemaChange);
      
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: error || (result && result.length > 0 && typeof result[0].message === 'string' ? result[0].message : 'Query executed successfully.'),
        timestamp: new Date(),
        result,
        error,
        success,
      };

      setMessages(prev => [...prev, systemMessage]);
      setLoading(false);
    }, 800);
  };

  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await executeQuery(input, 'chat');
    setInput('');
  };

  const handleCodeExecute = async () => {
    await executeQuery(codeInput, 'code');
  };

  const handleGenerateSql = () => {
    const generated = generateSQLCode(schema);
    setCodeInput(generated);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 font-sans">
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Terminal size={20} className="text-blue-400" />
          <h1 className="text-lg font-bold text-gray-100">SQL Chat</h1>
        </div>
        <div className="flex items-center bg-gray-800/60 border border-gray-700/50 rounded-md p-1">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 text-sm rounded-md transition-all duration-200 flex items-center gap-2 ${activeTab === 'chat' ? 'bg-blue-600/80 text-white shadow-md' : 'text-gray-400 hover:bg-gray-700/50'}`}
          >
            <MessageSquare size={14} />
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('code')}
            className={`px-4 py-1.5 text-sm rounded-md transition-all duration-200 flex items-center gap-2 ${activeTab === 'code' ? 'bg-blue-600/80 text-white shadow-md' : 'text-gray-400 hover:bg-gray-700/50'}`}
          >
            <Code size={14} />
            Code Editor
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-4xl p-4 rounded-lg shadow-md ${
                    message.type === 'user' 
                      ? 'bg-gradient-to-r from-blue-600/90 to-blue-500/90 text-white backdrop-blur-sm border border-blue-500/30' 
                      : message.error
                      ? 'bg-gradient-to-r from-red-900/50 to-red-800/50 border border-red-500/40 text-red-100 backdrop-blur-sm'
                      : message.success
                      ? 'bg-gradient-to-r from-emerald-900/50 to-green-800/50 border border-emerald-500/40 text-emerald-100 backdrop-blur-sm'
                      : 'bg-gray-900/70 border border-gray-700/50 text-gray-100 backdrop-blur-sm'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {message.success && <CheckCircle size={14} className="text-emerald-400" />}
                        {message.error && <AlertCircle size={14} className="text-red-400" />}
                        <span className="font-semibold text-sm">{message.type === 'user' ? 'You' : 'System'}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.result && message.result.length > 0 && !message.result[0].message && (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-xs text-left bg-gray-900/50 rounded-md">
                          <thead className="bg-gray-800/60">
                            <tr>
                              {Object.keys(message.result[0] || {}).map(key => (
                                <th key={key} className="p-2 font-semibold text-gray-300">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {message.result.map((row: Record<string, unknown>, i: number) => (
                              <tr key={i} className="border-t border-gray-700/50 hover:bg-gray-800/40">
                                {Object.values(row).map((val: unknown, j: number) => (
                                  <td key={j} className="p-2 text-gray-400">{String(val)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-3 text-xs text-gray-400">
                          {message.result.length} row(s) returned
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-6 border-t border-gray-700/50 bg-gray-900/40 backdrop-blur-sm">
              <form onSubmit={handleChatSubmit} className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your SQL query or command..."
                  className="w-full bg-gray-900/80 border border-gray-600/50 text-gray-200 placeholder-gray-500 rounded-md py-3 pl-4 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all duration-200 text-sm"
                  disabled={isExecuting}
                />
                <button 
                  type="submit" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-all duration-200 flex items-center justify-center"
                  disabled={isExecuting || !input.trim()}
                >
                  {isExecuting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-700/50 bg-gray-900/60">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleCodeExecute}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-md flex items-center gap-2 transition-all duration-200"
                  disabled={isCodeExecuting}
                >
                  {isCodeExecuting ? <Loader2 size={14} className="animate-spin"/> : <Play size={14} />}
                  Execute
                </button>
                <button 
                  onClick={handleGenerateSql}
                  className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md flex items-center gap-2 transition-all duration-200"
                >
                  Generate SQL from Schema
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-950">
              <Editor
                height="100%"
                language="sql"
                theme="vs-dark"
                value={codeInput}
                onChange={(value) => setCodeInput(value || '')}
                options={{ 
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  padding: { top: 15 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;