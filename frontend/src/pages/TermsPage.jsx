import { Helmet } from 'react-helmet-async';

export default function TermsPage() {
  return (
    <div className="page-enter container" style={{ paddingTop: '40px', paddingBottom: '80px', maxWidth: '800px' }}>
      <Helmet>
        <title>Terms of Service - FFDB</title>
        <meta name="description" content="Terms of Service for the Flora and Fauna Database of Bangladesh (FFDB)." />
      </Helmet>

      <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '24px' }}>Terms of Service</h1>
      
      <div className="content-block" style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '16px' }}>
          By accessing and using the Flora and Fauna Database of Bangladesh (FFDB), you agree to comply with and be bound by the following terms and conditions.
        </p>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          1. Use of Content
        </h2>
        <p style={{ marginBottom: '16px' }}>
          All data, images, and text provided on FFDB are for educational, research, and informational purposes. While we strive for accuracy, we cannot guarantee the completeness or reliability of the information.
        </p>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          2. User Contributions
        </h2>
        <p style={{ marginBottom: '16px' }}>
          If you submit data, reports, or images to FFDB, you grant us the right to use, modify, and display that content on our platform. You must ensure you have the necessary rights to any content you provide.
        </p>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          3. Limitation of Liability
        </h2>
        <p style={{ marginBottom: '16px' }}>
          FFDB and its contributors shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use our platform.
        </p>
      </div>
    </div>
  );
}
