#!/bin/bash

# Security Check Script
# This script runs various security checks and generates a report

set -e

echo "🔒 Running comprehensive security checks..."

# Create security report directory
mkdir -p reports/security

# Date for report naming
DATE=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/security"
REPORT_FILE="$REPORT_DIR/security_report_$DATE.md"

# Initialize report
cat > "$REPORT_FILE" << EOF
# Security Report - $(date)

## Summary
This report contains the results of automated security checks run on the bug-bounty-admin-api project.

---

EOF

echo "📝 Generating security report: $REPORT_FILE"

# 1. NPM Audit
echo "🔍 Running npm audit..."
echo "## NPM Audit Results" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
if npm audit --json > "$REPORT_DIR/npm_audit_$DATE.json" 2>/dev/null; then
    echo "✅ NPM audit completed successfully" >> "$REPORT_FILE"
    vulnerabilities=$(cat "$REPORT_DIR/npm_audit_$DATE.json" | jq '.metadata.vulnerabilities | to_entries | map({severity: .key, count: .value}) | map("\(.severity): \(.count)") | join(", ")')
    echo "- Vulnerabilities found: $vulnerabilities" >> "$REPORT_FILE"
else
    echo "⚠️ NPM audit found issues. See npm_audit_$DATE.json for details." >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 2. TypeScript strict checks
echo "📝 Running TypeScript strict checks..."
echo "## TypeScript Security Checks" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
if npm run typecheck > "$REPORT_DIR/typecheck_$DATE.log" 2>&1; then
    echo "✅ TypeScript compilation successful - no type safety issues" >> "$REPORT_FILE"
else
    echo "❌ TypeScript compilation failed - potential type safety issues detected" >> "$REPORT_FILE"
    echo "See typecheck_$DATE.log for details." >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 3. ESLint security rules
echo "🔍 Running ESLint security checks..."
echo "## ESLint Security Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
if npx eslint . --ext .ts --config .eslintrc.advanced.js --format json > "$REPORT_DIR/eslint_security_$DATE.json" 2>/dev/null; then
    security_issues=$(cat "$REPORT_DIR/eslint_security_$DATE.json" | jq '[.[] | .messages[] | select(.ruleId | startswith("security/"))] | length')
    echo "✅ ESLint security analysis completed" >> "$REPORT_FILE"
    echo "- Security-related issues found: $security_issues" >> "$REPORT_FILE"
else
    echo "⚠️ ESLint security analysis found issues. See eslint_security_$DATE.json for details." >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 4. Dependency vulnerability scan (if snyk is installed)
echo "🔍 Checking for Snyk..."
if command -v snyk &> /dev/null; then
    echo "## Snyk Vulnerability Scan" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    if snyk test --json > "$REPORT_DIR/snyk_$DATE.json" 2>/dev/null; then
        echo "✅ Snyk scan completed - no vulnerabilities found" >> "$REPORT_FILE"
    else
        vulnerabilities=$(cat "$REPORT_DIR/snyk_$DATE.json" | jq '.vulnerabilities | length' 2>/dev/null || echo "unknown")
        echo "⚠️ Snyk scan found $vulnerabilities vulnerabilities" >> "$REPORT_FILE"
        echo "See snyk_$DATE.json for details." >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
else
    echo "## Snyk Vulnerability Scan" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "⚠️ Snyk not installed - skipping detailed vulnerability scan" >> "$REPORT_FILE"
    echo "Install Snyk CLI for comprehensive vulnerability scanning: npm install -g snyk" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# 5. Secret detection (if gitleaks is installed)
echo "🔐 Checking for secrets..."
if command -v gitleaks &> /dev/null; then
    echo "## Secret Detection (Gitleaks)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    if gitleaks detect --report-format json --report-path "$REPORT_DIR/gitleaks_$DATE.json" --verbose --no-git 2>/dev/null; then
        echo "✅ No secrets detected in codebase" >> "$REPORT_FILE"
    else
        secrets_found=$(cat "$REPORT_DIR/gitleaks_$DATE.json" | jq 'length' 2>/dev/null || echo "unknown")
        echo "❌ $secrets_found potential secrets detected" >> "$REPORT_FILE"
        echo "See gitleaks_$DATE.json for details." >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
else
    echo "## Secret Detection" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "⚠️ Gitleaks not installed - skipping secret detection" >> "$REPORT_FILE"
    echo "Install Gitleaks for secret detection: https://github.com/zricethezav/gitleaks" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# 6. Security headers check (basic)
echo "🌐 Checking security headers..."
echo "## Security Headers Configuration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Security headers configured in application:" >> "$REPORT_FILE"
grep -n "helmet\|cors\|csp" src/app.ts | sed 's/^/- /' >> "$REPORT_FILE" || echo "- No security headers configuration found" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 7. Docker security (if Dockerfile exists)
if [ -f "Dockerfile" ]; then
    echo "🐳 Checking Docker security..."
    echo "## Docker Security Analysis" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Check for common Docker security issues
    docker_issues=0
    
    if grep -q "FROM.*:latest" Dockerfile; then
        echo "⚠️ Using 'latest' tag in Docker image - specify explicit versions" >> "$REPORT_FILE"
        docker_issues=$((docker_issues + 1))
    fi
    
    if ! grep -q "USER " Dockerfile; then
        echo "⚠️ Running as root user - consider adding non-root user" >> "$REPORT_FILE"
        docker_issues=$((docker_issues + 1))
    fi
    
    if ! grep -q "HEALTHCHECK" Dockerfile; then
        echo "⚠️ No health check defined - consider adding HEALTHCHECK instruction" >> "$REPORT_FILE"
        docker_issues=$((docker_issues + 1))
    fi
    
    if [ $docker_issues -eq 0 ]; then
        echo "✅ Docker configuration looks secure" >> "$REPORT_FILE"
    else
        echo "⚠️ Found $docker_issues potential Docker security issues" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
fi

# 8. Environment variable security check
echo "🔧 Checking environment variable security..."
echo "## Environment Variable Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

env_issues=0

# Check for hardcoded secrets in config files
if grep -r "password\|secret\|key" src/config/ --include="*.ts" | grep -v "process.env" | grep -v "// " | grep -v "\*" > /dev/null 2>&1; then
    echo "⚠️ Potential hardcoded secrets found in config files" >> "$REPORT_FILE"
    env_issues=$((env_issues + 1))
fi

# Check if .env.example exists
if [ -f ".env.example" ]; then
    echo "✅ .env.example file exists for documentation" >> "$REPORT_FILE"
else
    echo "⚠️ No .env.example file - consider adding for documentation" >> "$REPORT_FILE"
    env_issues=$((env_issues + 1))
fi

# Check if .env is in .gitignore
if grep -q "\.env" .gitignore 2>/dev/null; then
    echo "✅ .env files properly ignored in git" >> "$REPORT_FILE"
else
    echo "❌ .env files not in .gitignore - potential secret leak risk" >> "$REPORT_FILE"
    env_issues=$((env_issues + 1))
fi

if [ $env_issues -eq 0 ]; then
    echo "✅ Environment variable configuration looks secure" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# 9. Generate recommendations
echo "## Security Recommendations" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### Immediate Actions" >> "$REPORT_FILE"
echo "- [ ] Review and fix any critical vulnerabilities found above" >> "$REPORT_FILE"
echo "- [ ] Ensure all dependencies are up to date" >> "$REPORT_FILE"
echo "- [ ] Verify no secrets are committed to the repository" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### Best Practices" >> "$REPORT_FILE"
echo "- [ ] Regular security audits (weekly/monthly)" >> "$REPORT_FILE"
echo "- [ ] Implement automated security testing in CI/CD" >> "$REPORT_FILE"
echo "- [ ] Use semantic versioning for dependencies" >> "$REPORT_FILE"
echo "- [ ] Implement proper error handling to avoid information disclosure" >> "$REPORT_FILE"
echo "- [ ] Regular penetration testing" >> "$REPORT_FILE"
echo "- [ ] Security training for development team" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 10. Report completion
echo "## Report Generated" >> "$REPORT_FILE"
echo "- Date: $(date)" >> "$REPORT_FILE"
echo "- Tool versions:" >> "$REPORT_FILE"
echo "  - Node.js: $(node --version)" >> "$REPORT_FILE"
echo "  - NPM: $(npm --version)" >> "$REPORT_FILE"
echo "  - TypeScript: $(npx tsc --version)" >> "$REPORT_FILE"

if command -v snyk &> /dev/null; then
    echo "  - Snyk: $(snyk --version)" >> "$REPORT_FILE"
fi

if command -v gitleaks &> /dev/null; then
    echo "  - Gitleaks: $(gitleaks version)" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "*This report was generated automatically. Manual review is recommended.*" >> "$REPORT_FILE"

echo ""
echo "✅ Security check completed!"
echo "📄 Report generated: $REPORT_FILE"
echo ""
echo "📊 Summary:"
echo "- NPM audit: $([ -f "$REPORT_DIR/npm_audit_$DATE.json" ] && echo "✅ Completed" || echo "❌ Failed")"
echo "- TypeScript check: $([ -f "$REPORT_DIR/typecheck_$DATE.log" ] && echo "✅ Completed" || echo "❌ Failed")"
echo "- ESLint security: $([ -f "$REPORT_DIR/eslint_security_$DATE.json" ] && echo "✅ Completed" || echo "❌ Failed")"
echo "- Secret detection: $(command -v gitleaks &> /dev/null && echo "✅ Available" || echo "⚠️ Not installed")"
echo "- Vulnerability scan: $(command -v snyk &> /dev/null && echo "✅ Available" || echo "⚠️ Not installed")"

echo ""
echo "🔍 Review the full report for detailed findings and recommendations."