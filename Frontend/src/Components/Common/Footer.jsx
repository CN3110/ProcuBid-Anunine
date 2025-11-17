import React from 'react';
import '../../styles/footer.css';

const Footer = () => {
  const logos = [
    '/assets/KSPA Packaging (1).png',
    '/assets/Ethimale_sugar_RGB_Logo.png',
    '/assets/KSPA Accessories (1).png',
    '/assets/ATIRE (1).png',
    '/assets/RECYplas.png',
    '/assets/Ep.png',
    '/assets/RECY-Traders.png',
    '/assets/KSPA_Paper_RGB_Logo.png',
    
  ];

  return (
    <footer className="footer">
      <div className="logo-grid">
        {logos.map((logo, index) => (
          <div className="logo-item" key={index}>
            <img src={logo} alt={`Logo ${index + 1}`} />
          </div>
        ))}
      </div>
      <p className="footer-copy">
        ©2025 All rights reserved, Anunine Holdings Private Limited.
      </p>
    </footer>
  );
};

export default Footer;
