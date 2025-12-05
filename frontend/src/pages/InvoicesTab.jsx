import React, { useState, useEffect } from 'react';
import { apiUrl } from '../api';

export default function InvoicesTab({ userType, userId }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, userId]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/invoices/${userType}/${userId}`));
      
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      } else {
        throw new Error('Fehler beim Laden');
      }
    } catch (err) {
      setError('Rechnungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const viewInvoice = (invoiceId) => {
    // Öffnet Rechnung in neuem Tab
    window.open(apiUrl(`/api/invoices/${invoiceId}/view`), '_blank');
  };

  const downloadInvoice = async (invoice) => {
    // Öffnet Rechnung zum Drucken/Speichern
    const printWindow = window.open(apiUrl(`/api/invoices/${invoice.id}/view`), '_blank');
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            Bezahlt
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            Ausstehend
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
            Fehlgeschlagen
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
            {status}
          </span>
        );
    }
  };

  const getInvoiceTypeLabel = (type) => {
    switch (type) {
      case 'lv_creation':
        return 'LV-Erstellung';
      case 'commission':
        return 'Vermittlungsprovision';
      default:
        return type;
    }
  };

  // Filter-Logik
  const filteredInvoices = invoices.filter(invoice => {
    if (filterStatus !== 'all' && invoice.status !== filterStatus) return false;
    if (filterYear !== 'all') {
      const invoiceYear = new Date(invoice.created_at).getFullYear().toString();
      if (invoiceYear !== filterYear) return false;
    }
    return true;
  });

  // Verfügbare Jahre für Filter
  const availableYears = [...new Set(invoices.map(i => 
    new Date(i.created_at).getFullYear()
  ))].sort((a, b) => b - a);

  // Summen berechnen
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + parseFloat(i.gross_amount), 0);
  
  const totalPending = invoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + parseFloat(i.gross_amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Rechnungen</h2>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Übersichtskarten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Gesamt bezahlt</p>
          <p className="text-2xl font-bold text-green-400">
            {totalPaid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Ausstehend</p>
          <p className="text-2xl font-bold text-yellow-400">
            {totalPending.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Anzahl Rechnungen</p>
          <p className="text-2xl font-bold text-white">{invoices.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all" className="bg-slate-800">Alle</option>
            <option value="paid" className="bg-slate-800">Bezahlt</option>
            <option value="pending" className="bg-slate-800">Ausstehend</option>
            <option value="failed" className="bg-slate-800">Fehlgeschlagen</option>
          </select>
        </div>
        
        <div>
          <label className="block text-gray-400 text-sm mb-1">Jahr</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all" className="bg-slate-800">Alle Jahre</option>
            {availableYears.map(year => (
              <option key={year} value={year} className="bg-slate-800">{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rechnungsliste */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white/5 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-gray-400">Keine Rechnungen vorhanden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <div 
              key={invoice.id}
              className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Rechnungsinfo */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-semibold">{invoice.invoice_number}</span>
                    {getStatusBadge(invoice.status)}
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>
                      <span className="text-gray-500">Typ:</span>{' '}
                      {getInvoiceTypeLabel(invoice.invoice_type)}
                    </p>
                    <p>
                      <span className="text-gray-500">Datum:</span>{' '}
                      {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                    </p>
                    {invoice.street && (
                      <p>
                        <span className="text-gray-500">Projekt:</span>{' '}
                        {invoice.street} {invoice.house_number}, {invoice.zip_code} {invoice.city}
                      </p>
                    )}
                    {invoice.description && (
                      <p className="text-gray-300">{invoice.description}</p>
                    )}
                  </div>
                </div>

                {/* Beträge */}
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">
                    Netto: {parseFloat(invoice.net_amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                  <div className="text-sm text-gray-400 mb-1">
                    USt. {invoice.vat_rate}%: {parseFloat(invoice.vat_amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                  <div className="text-lg font-bold text-white">
                    {parseFloat(invoice.gross_amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>

                {/* Aktionen */}
                <div className="flex gap-2">
                  <button
                    onClick={() => viewInvoice(invoice.id)}
                    className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 rounded-lg transition-colors flex items-center gap-2"
                    title="Rechnung ansehen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    <span className="hidden sm:inline">Ansehen</span>
                  </button>
                  <button
                    onClick={() => downloadInvoice(invoice)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
                    title="Rechnung drucken/speichern"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                    </svg>
                    <span className="hidden sm:inline">Drucken</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hinweis */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
        <p className="text-blue-300 text-sm">
          <strong>ℹ️ Hinweis:</strong> Alle Rechnungen werden automatisch an Ihre hinterlegte E-Mail-Adresse gesendet. 
          Sie können Rechnungen hier jederzeit erneut einsehen und für Ihre Buchhaltung ausdrucken.
        </p>
      </div>
    </div>
  );
}
