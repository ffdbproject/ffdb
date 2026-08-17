import { Helmet } from 'react-helmet-async';

export default function PrivacyPage() {
  return (
    <div className="page-enter container" style={{ paddingTop: '40px', paddingBottom: '80px', maxWidth: '800px' }}>
      <Helmet>
        <title>Privacy Policy - FFDB</title>
        <meta name="description" content="Privacy Policy for the Flora and Fauna Database of Bangladesh (FFDB)." />
      </Helmet>

      <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '24px' }}>Privacy Policy</h1>
      
      <div className="content-block" style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '16px' }}>
          Welcome to the Flora and Fauna Database of Bangladesh (FFDB). We value your privacy and are committed to protecting your personal data.
        </p>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          Information We Collect
        </h2>
        <p style={{ marginBottom: '16px' }}>
          When you use our website, we may collect the following types of information:
        </p>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li style={{ marginBottom: '8px' }}><strong>Voluntary Information:</strong> Data you provide when reporting a problem, contacting us, or submitting contributions.</li>
          <li style={{ marginBottom: '8px' }}><strong>Usage Data:</strong> Anonymous data about how you interact with our website to help us improve the user experience.</li>
        </ul>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          How We Use Your Information
        </h2>
        <p style={{ marginBottom: '16px' }}>
          We use the information we collect to maintain and improve the FFDB platform, respond to your inquiries, and ensure the accuracy of our biodiversity records.
        </p>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }}>
          Contact Us
        </h2>
        <p style={{ marginBottom: '16px' }}>
          If you have any questions about this Privacy Policy, please contact us via our Contact Us page.
        </p>
      </div>
    </div>
  );
}
