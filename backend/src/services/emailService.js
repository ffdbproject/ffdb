// ============================================================
// FFDB - Flora and Fauna Database of Bangladesh
// Email Service — Nodemailer-based email notifications
// ============================================================

const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Create transporter lazily (only if SMTP is configured)
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  return transporter;
}

function getFromAddress() {
  const name = process.env.EMAIL_FROM_NAME || 'FFDB';
  const address = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
  return `"${name}" <${address}>`;
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || null;
}

/**
 * Send an email notification when a problem report is submitted.
 * Fire-and-forget: errors are logged but never thrown.
 */
async function sendReportNotification(report) {
  try {
    const t = getTransporter();
    const adminEmail = getAdminEmail();
    if (!t || !adminEmail) return;

    const reportTitle = escapeHtml(report.title || '');
    const reportEmail = escapeHtml(report.email || 'Not provided');
    const reportDescription = escapeHtml(report.description || '');
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #ef4444; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold;">New Problem Report</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="font-size: 16px; margin-bottom: 20px;">A new problem report has been submitted on FFDB.</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; width: 35%;"><strong>Title:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${reportTitle}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Status:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><span style="background: #fef08a; color: #a16207; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">OPEN</span></td></tr>
            ${report.species_id ? `<tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Species ID:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">#${report.species_id}</td></tr>` : ''}
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Reporter Email:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${reportEmail}</td></tr>
          </table>
          <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
            <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Description</h3>
            <p style="margin: 0; font-size: 15px;">${reportDescription}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://ffdb.bd/admin" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">View in Dashboard</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; color: #94a3b8; text-align: center; padding: 15px; font-size: 12px;">
          Submitted: ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    await t.sendMail({
      from: getFromAddress(),
      to: adminEmail,
      subject: `[FFDB] New Problem Report: ${String(report.title || '').replace(/[\r\n]/g, ' ')}`,
      html: htmlBody,
    });

    console.log(`[Email] Report notification sent to ${adminEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send report notification:', err.message);
  }
}

/**
 * Send an email notification when a species is submitted.
 * @param {Object} species - The species record
 * @param {string} source - 'contributor' | 'public' | 'admin'
 * @param {string|null} contributorLabel - The contributor label (e.g. 'alice')
 */
async function sendSpeciesSubmissionNotification(species, source, contributorLabel) {
  try {
    const t = getTransporter();
    const adminEmail = getAdminEmail();
    if (!t || !adminEmail) return;

    // Don't email admin for their own submissions
    if (source === 'admin') return;

    const sourceLabel = source === 'contributor'
      ? `Contributor (${contributorLabel || 'unknown'})`
      : 'Public contribution form';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #22c55e; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold;">New Species Submission</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #334155; line-height: 1.6;">
          <p style="font-size: 16px; margin-bottom: 20px; text-align: center;">A new species has been submitted for review on FFDB.</p>
          <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
            <h3 style="margin: 0; font-size: 24px; font-style: italic; color: #0f172a;">${species.scientific_name}</h3>
            ${species.english_name ? `<p style="margin: 6px 0 0; font-size: 16px; color: #64748b;">${species.english_name}</p>` : ''}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; width: 35%;"><strong>Category:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-transform: capitalize;">${species.category || 'flora'}</td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Status:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><span style="background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${species.status || 'draft'}</span></td></tr>
            <tr><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Source:</strong></td><td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${sourceLabel}</td></tr>
          </table>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://ffdb.bd/admin" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Review Submission</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; color: #94a3b8; text-align: center; padding: 15px; font-size: 12px;">
          Submitted: ${new Date().toLocaleString()}
        </div>
      </div>
    `;

    await t.sendMail({
      from: getFromAddress(),
      to: adminEmail,
      subject: `[FFDB] New Species Submission: ${species.scientific_name}`,
      html: htmlBody,
    });

    console.log(`[Email] Species submission notification sent to ${adminEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send species submission notification:', err.message);
  }
}

module.exports = {
  sendReportNotification,
  sendSpeciesSubmissionNotification,
};
