import unittest
from unittest.mock import patch
import json
from app import app, fetch_and_parse_feed

class TestBigQueryReleaseNotes(unittest.TestCase):
    
    def setUp(self):
        """Configure test client and environment."""
        self.app = app.test_client()
        self.app.testing = True

    def test_index_route(self):
        """Test that the homepage route loads successfully."""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'BigQuery Release Notes Tracker', response.data)

    @patch('requests.get')
    def test_feed_parsing(self, mock_get):
        """Test XML Atom parsing and category splitting logic."""
        # Mock XML response with 1 entry containing multiple HTML updates
        mock_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
            <title>Test BigQuery Feed</title>
            <entry>
                <title>June 17, 2026</title>
                <id>tag:google.com,2016:bigquery-release-notes#June_17_2026</id>
                <updated>2026-06-17T00:00:00-07:00</updated>
                <link rel="alternate" href="https://example.com/notes#June_17_2026"/>
                <content type="html"><![CDATA[
                    <h3>Feature</h3>
                    <p>New feature details here.</p>
                    <h3>Issue</h3>
                    <p>Known issue description.</p>
                ]]></content>
            </entry>
        </feed>
        """
        mock_get.return_value.text = mock_xml
        mock_get.return_value.status_code = 200
        
        # Parse simulated data
        result = fetch_and_parse_feed()
        
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['feed_title'], 'Test BigQuery Feed')
        self.assertEqual(len(result['entries']), 1)
        
        entry = result['entries'][0]
        self.assertEqual(entry['date'], 'June 17, 2026')
        
        # Verify it split the entry content into two updates
        self.assertEqual(len(entry['updates']), 2)
        
        # Assert 1st update details (Feature)
        self.assertEqual(entry['updates'][0]['category'], 'Feature')
        self.assertIn('New feature details', entry['updates'][0]['description'])
        self.assertEqual(entry['updates'][0]['raw_text'], 'New feature details here.')
        
        # Assert 2nd update details (Issue)
        self.assertEqual(entry['updates'][1]['category'], 'Issue')
        self.assertIn('Known issue description', entry['updates'][1]['description'])
        self.assertEqual(entry['updates'][1]['raw_text'], 'Known issue description.')

    @patch('requests.get')
    def test_api_endpoint(self, mock_get):
        """Test API endpoint responses and structure."""
        # Mock successful fetch
        mock_get.return_value.text = """<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom"><title>API Test</title></feed>"""
        mock_get.return_value.status_code = 200
        
        response = self.app.get('/api/feed?refresh=true')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data.decode('utf-8'))
        self.assertEqual(data['status'], 'success')

if __name__ == '__main__':
    unittest.main()
