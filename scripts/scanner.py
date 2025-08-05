#!/usr/bin/env python3
"""
Bug Bounty Scanner Simulator
Simulates a cybersecurity scanner that submits vulnerability reports to the Bug Bounty Admin API
"""

import json
import random
import sys
from datetime import datetime
from typing import Dict, List, Optional

try:
    import requests
except ImportError:
    print("Error: requests library not installed. Please run: pip install requests")
    sys.exit(1)


class BugBountyScanner:
    """Simulated vulnerability scanner for bug bounty platform"""
    
    def __init__(self, api_base_url: str, api_token: str):
        self.api_base_url = api_base_url.rstrip('/')
        self.api_token = api_token
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        }
    
    def generate_dummy_report(self) -> Dict:
        """Generate a realistic dummy vulnerability report"""
        vulnerabilities = [
            {
                'title': 'SQL Injection in User Search Endpoint',
                'category': 'SQL Injection',
                'severity': 'critical',
                'description': 'SQL injection vulnerability found in the /api/users/search endpoint. The "query" parameter is not properly sanitized.',
                'affected_asset': 'https://example.com/api/users/search',
                'reproduction_steps': [
                    'Navigate to /api/users/search',
                    'Set query parameter to: \' OR 1=1--',
                    'Observe that all users are returned'
                ],
                'impact': 'Attacker can extract entire database contents, modify data, or perform administrative operations.'
            },
            {
                'title': 'Cross-Site Scripting (XSS) in Comment Section',
                'category': 'XSS',
                'severity': 'high',
                'description': 'Stored XSS vulnerability in the comment section allows execution of arbitrary JavaScript.',
                'affected_asset': 'https://example.com/blog/comments',
                'reproduction_steps': [
                    'Go to any blog post',
                    'Submit comment with payload: <script>alert("XSS")</script>',
                    'Reload page and observe script execution'
                ],
                'impact': 'Attackers can steal user sessions, redirect users to malicious sites, or deface the website.'
            },
            {
                'title': 'Exposed API Keys in JavaScript Bundle',
                'category': 'Information Disclosure',
                'severity': 'high',
                'description': 'Production API keys are exposed in the minified JavaScript bundle.',
                'affected_asset': 'https://example.com/static/js/app.min.js',
                'reproduction_steps': [
                    'View page source',
                    'Search for "api_key" in bundle',
                    'Find exposed keys: AIzaSyB...'
                ],
                'impact': 'Exposed API keys can be used to access backend services and incur costs.'
            },
            {
                'title': 'Weak Password Reset Token Generation',
                'category': 'Authentication',
                'severity': 'medium',
                'description': 'Password reset tokens are predictable due to weak random number generation.',
                'affected_asset': 'https://example.com/auth/reset-password',
                'reproduction_steps': [
                    'Request password reset',
                    'Analyze token pattern',
                    'Tokens follow predictable timestamp-based pattern'
                ],
                'impact': 'Attackers can predict reset tokens and take over user accounts.'
            },
            {
                'title': 'Missing Rate Limiting on Login Endpoint',
                'category': 'Brute Force',
                'severity': 'medium',
                'description': 'No rate limiting implemented on login endpoint allowing brute force attacks.',
                'affected_asset': 'https://example.com/api/auth/login',
                'reproduction_steps': [
                    'Send 1000 login requests in 1 minute',
                    'All requests are processed',
                    'No blocking or rate limiting observed'
                ],
                'impact': 'Attackers can perform brute force attacks to compromise user accounts.'
            }
        ]
        
        vuln = random.choice(vulnerabilities)
        return {
            'title': vuln['title'],
            'description': vuln['description'],
            'severity': vuln['severity'],
            'category': vuln['category'],
            'affectedAsset': vuln['affected_asset'],
            'reproductionSteps': vuln['reproduction_steps'],
            'impact': vuln['impact'],
            'submittedBy': f'scanner-{random.randint(1000, 9999)}@bugbounty.com'
        }
    
    def submit_report(self, report: Dict) -> Optional[Dict]:
        """Submit a vulnerability report to the API"""
        try:
            response = requests.post(
                f'{self.api_base_url}/api/v1/reports',
                headers=self.headers,
                json=report,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f'Error submitting report: {e}')
            if hasattr(e, 'response') and e.response is not None:
                print(f'Response: {e.response.text}')
            return None
    
    def scan_and_submit(self, count: int = 1) -> List[Dict]:
        """Generate and submit multiple vulnerability reports"""
        submitted_reports = []
        
        for i in range(count):
            print(f'\\nGenerating vulnerability report {i+1}/{count}...')
            report = self.generate_dummy_report()
            
            print(f'Title: {report["title"]}')
            print(f'Severity: {report["severity"]}')
            print(f'Category: {report["category"]}')
            
            result = self.submit_report(report)
            if result and result.get('success'):
                print(f'✓ Report submitted successfully! ID: {result["data"]["id"]}')
                submitted_reports.append(result['data'])
            else:
                print('✗ Failed to submit report')
        
        return submitted_reports


def main():
    """Main function to run the scanner"""
    # Configuration
    API_URL = 'http://localhost:3000'
    API_TOKEN = 'test-api-token-123'  # Should match .env configuration
    
    print('🔍 Bug Bounty Scanner Simulator')
    print('=' * 50)
    print(f'Target API: {API_URL}')
    print(f'Timestamp: {datetime.now().isoformat()}')
    
    # Initialize scanner
    scanner = BugBountyScanner(API_URL, API_TOKEN)
    
    # Check if API is accessible
    try:
        health_response = requests.get(f'{API_URL}/health', timeout=5)
        if health_response.status_code == 200:
            print('✓ API is healthy')
        else:
            print('✗ API health check failed')
            sys.exit(1)
    except requests.exceptions.RequestException:
        print('✗ Cannot connect to API. Make sure the server is running.')
        print('  Run: npm run dev')
        sys.exit(1)
    
    # Submit vulnerability reports
    print('\\nStarting vulnerability scan...')
    reports = scanner.scan_and_submit(count=3)
    
    # Summary
    print(f'\\n{"=" * 50}')
    print(f'Scan complete! Submitted {len(reports)} vulnerability reports.')
    
    if reports:
        print('\\nSubmitted Reports:')
        for report in reports:
            print(f'  - ID: {report["id"]} | {report["title"]} [{report["severity"]}]')


if __name__ == '__main__':
    main()