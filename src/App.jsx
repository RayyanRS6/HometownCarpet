import { useEffect } from 'react';
import pageMarkup from './page.html?raw';
import { initializeWebsite } from './site.js';
import './styles.css';

export default function App() {
  useEffect(() => {
    initializeWebsite();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: pageMarkup }} />;
}
