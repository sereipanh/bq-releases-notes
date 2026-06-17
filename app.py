import os
import requests
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cached_feed_data = None

def fetch_and_parse_feed():
    global cached_feed_data
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse XML
        xml_text = response.text
        root = ET.fromstring(xml_text)
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        # Get feed title
        feed_title_elem = root.find('atom:title', namespaces)
        feed_title = feed_title_elem.text if feed_title_elem is not None else "BigQuery Release Notes"
        
        for entry in root.findall('atom:entry', namespaces):
            title_elem = entry.find('atom:title', namespaces)
            updated_elem = entry.find('atom:updated', namespaces)
            link_elem = entry.find('atom:link[@rel="alternate"]', namespaces)
            if link_elem is None:
                link_elem = entry.find('atom:link', namespaces)
            
            content_elem = entry.find('atom:content', namespaces)
            
            date_str = title_elem.text if title_elem is not None else ""
            updated_str = updated_elem.text if updated_elem is not None else ""
            link_url = link_elem.attrib.get('href', '') if link_elem is not None else ""
            html_content = content_elem.text if content_elem is not None else ""
            
            # Parse sub-updates from html content
            soup = BeautifulSoup(html_content, 'html.parser')
            updates = []
            h3s = soup.find_all('h3')
            
            if not h3s:
                # Fallback if there are no H3 elements
                desc_html = str(soup)
                plain_text = soup.get_text().strip()
                # Clean whitespace
                plain_text = " ".join(plain_text.split())
                updates.append({
                    'id': f"{date_str.replace(' ', '_')}_0",
                    'category': 'General',
                    'description': desc_html,
                    'raw_text': plain_text
                })
            else:
                for idx, h3 in enumerate(h3s):
                    category = h3.get_text().strip()
                    
                    # Gather siblings until the next h3
                    desc_parts = []
                    sibling = h3.next_sibling
                    while sibling and sibling.name != 'h3':
                        desc_parts.append(str(sibling))
                        sibling = sibling.next_sibling
                    
                    desc_html = "".join(desc_parts).strip()
                    temp_soup = BeautifulSoup(desc_html, 'html.parser')
                    plain_text = temp_soup.get_text().strip()
                    plain_text = " ".join(plain_text.split())
                    
                    updates.append({
                        'id': f"{date_str.replace(' ', '_')}_{idx}",
                        'category': category,
                        'description': desc_html,
                        'raw_text': plain_text
                    })
            
            entries.append({
                'date': date_str,
                'updated': updated_str,
                'link': link_url,
                'updates': updates
            })
            
        cached_feed_data = {
            'status': 'success',
            'feed_title': feed_title,
            'entries': entries
        }
        return cached_feed_data
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/feed')
def get_feed():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    global cached_feed_data
    if cached_feed_data is None or refresh:
        data = fetch_and_parse_feed()
        if data.get('status') == 'error' and cached_feed_data is not None:
            return jsonify({
                **cached_feed_data,
                'warning': 'Failed to fetch new data. Showing cached version.',
                'error_detail': data.get('message')
            })
        return jsonify(data)
    return jsonify(cached_feed_data)

if __name__ == '__main__':
    # Use environment variable for port, default to 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
