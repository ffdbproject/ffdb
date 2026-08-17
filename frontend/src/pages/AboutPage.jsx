import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import '../styles/pages/about-page.css';

export default function AboutPage() {
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'About - FFDB',
    url: `${siteOrigin}/about`,
    description: 'Learn about Flora and Fauna Database of Bangladesh, our mission, vision, history, and conservation efforts.',
  };

  return (
    <div className="page-enter container" id="about-page" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <Helmet>
        <title>About - FFDB</title>
        <meta name="description" content="Learn about Flora and Fauna Database of Bangladesh, our mission, vision, history, and conservation efforts." />
        <meta name="author" content="FFDB" />
        <meta property="og:title" content="About - FFDB" />
        <meta property="og:description" content="Learn about Flora and Fauna Database of Bangladesh, our mission, vision, history, and conservation efforts." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteOrigin}/about`} />
        <meta property="og:site_name" content="FFDB" />
        <meta property="og:image" content={`${siteOrigin}/og-fallback.png`} />
        <meta property="og:image:alt" content="Flora and Fauna Database of Bangladesh" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="About - FFDB" />
        <meta name="twitter:description" content="Learn about Flora and Fauna Database of Bangladesh, our mission, vision, history, and conservation efforts." />
        <link rel="canonical" href={`${siteOrigin}/about`} />
        <script type="application/ld+json">{JSON.stringify(pageJsonLd)}</script>
      </Helmet>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '6px' }}>About</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px', lineHeight: 1.6 }}>
          Flora and Fauna Database of Bangladesh — mission, scope, and history.
        </p>

        <div className="about-content">
          {/* What is FFDB */}
          <section className="about-section">
            <h2 className="about-section-title">What is FFDB?</h2>
            <p className="about-section-text">
              Flora and Fauna Database of Bangladesh (FFDB) is an open, community-driven biodiversity information platform dedicated to documenting and sharing knowledge about Bangladesh's natural heritage. Our database provides species information including taxonomy, distribution, conservation status, and images.
            </p>
          </section>

          {/* Mission */}
          <section className="about-section">
            <h2 className="about-section-title">Our Mission</h2>
            <p className="about-section-text">
              To compile, verify, and disseminate accurate, evidence-based biodiversity information about Bangladesh's flora and fauna. We make this data freely and openly accessible to support conservation, research, and education.
            </p>
          </section>

          {/* Vision */}
          <section className="about-section">
            <h2 className="about-section-title">Our Vision</h2>
            <p className="about-section-text">
              A comprehensive, continually updated biodiversity database that empowers communities, researchers, and policymakers to conserve and sustainably manage natural resources in Bangladesh.
            </p>
          </section>

          {/* What FFDB Is NOT */}
          <section className="about-section">
            <h2 className="about-section-title">What FFDB Is Not</h2>
            <p className="about-section-text">
              FFDB is not a commercial marketplace, species trading platform, or product directory. We do not buy, sell, broker, or promote the sale of wildlife, plants, or biological materials in any form.
            </p>
            <p className="about-section-text">
              FFDB is also not a legal authority or a replacement for official government records, permits, or conservation regulations. Decisions involving compliance, protected status, legal trade, or enforcement should always be verified with the relevant national authorities and official publications.
            </p>
            <p className="about-section-text">
              In short, FFDB is a community-curated educational and reference resource. Our role is to organize and share biodiversity information responsibly, not to issue legal certifications, approvals, or binding scientific determinations.
            </p>
          </section>

          {/* History (plain) */}
          <section className="about-section">
            <h2 className="about-section-title">History of FFDB</h2>
            <p className="about-section-text">
              FFDB was founded to create a centralized, accessible repository of biodiversity data for Bangladesh. Since inception, we've focused on accuracy, accessibility, and community contribution and continue to add and improve species records.
            </p>
          </section>

          {/* Call to Action */}
          <section className="about-section about-cta">
            <h2 className="about-section-title">Get Involved</h2>
            <p className="about-section-text">
              FFDB is a community project. Whether you're a researcher, educator, photographer, or wildlife enthusiast, you can help us build a more complete picture of Bangladesh's biodiversity.
            </p>
            <div className="cta-buttons">
              <Link to="/contribute" className="cta-button cta-primary">
                Contribute Species Data
              </Link>
              <Link to="/report-problem" className="cta-button cta-secondary">
                Report an Issue
              </Link>
              <Link to="/api-docs" className="cta-button cta-secondary">
                Explore Our API
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
