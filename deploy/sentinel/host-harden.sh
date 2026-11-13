#!/bin/bash
# Host-level hardening: kernel network stack, SSH, unused services, fail2ban for SSH, ICMP flood cap, secret file permissions.
# Every change is reversible (config files listed at the end). SSH is validated with sshd -t before reload.
set -u
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l NEEDRESTART_SUSPEND=1
TS=$(date +%Y%m%d-%H%M%S)

echo "== 1. kernel network hardening (SYN flood / spoofing / redirects)"
sudo tee /etc/sysctl.d/90-ogen-hardening.conf >/dev/null <<'EOF'
# הקשחת מחסנית הרשת (נוסף 13.11.2026)
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_synack_retries = 3
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.unprivileged_bpf_disabled = 1
EOF
sudo sysctl --system >/dev/null 2>&1
sysctl net.ipv4.tcp_syncookies net.ipv4.tcp_max_syn_backlog net.core.netdev_max_backlog net.ipv4.tcp_synack_retries | paste -sd' '

echo "== 2. SSH hardening (drop-in, validated before reload)"
sudo tee /etc/ssh/sshd_config.d/01-ogen-hardening.conf >/dev/null <<'EOF'
# הקשחת SSH (נוסף 13.11.2026) - כניסה רק עם מפתח, בלי root, חלון ניחוש קצר, תיעוד טביעות אצבע של מפתחות
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 60
ClientAliveCountMax 3
MaxStartups 10:30:40
LogLevel VERBOSE
EOF
if sudo sshd -t; then sudo systemctl reload ssh && echo "sshd reloaded OK"; else echo "!! sshd -t failed - removing drop-in"; sudo rm -f /etc/ssh/sshd_config.d/01-ogen-hardening.conf; fi
sudo sshd -T 2>/dev/null | grep -E '^(permitrootlogin|passwordauthentication|maxauthtries|logingracetime|x11forwarding|maxstartups|loglevel)' | paste -sd' '

echo "== 3. disable unused network services (rpcbind: UDP/TCP 111 is an amplification vector)"
sudo systemctl disable --now rpcbind.service rpcbind.socket 2>&1 | grep -vE 'Synchronizing|Removed' | tail -2
sudo systemctl mask rpcbind.service rpcbind.socket 2>&1 | tail -1
sudo ss -lntup | awk '$5 ~ /:111$/' | wc -l | sed 's/^/listeners on :111 now: /'

echo "== 4. ICMP flood cap (ping still works, floods are dropped)"
if ! sudo iptables -C INPUT -p icmp --icmp-type echo-request -m limit --limit 20/second --limit-burst 50 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 2 -p icmp --icmp-type echo-request -m limit --limit 20/second --limit-burst 50 -j ACCEPT
  sudo iptables -I INPUT 3 -p icmp --icmp-type echo-request -j DROP
  sudo netfilter-persistent save >/dev/null 2>&1 && echo "iptables saved"
fi
sudo iptables -S INPUT | head -8

echo "== 5. fail2ban for SSH (nftables-based, independent of the iptables rules)"
sudo -E apt-get install -y --no-upgrade fail2ban >/tmp/f2b-install.log 2>&1 || { echo "fail2ban install failed"; tail -3 /tmp/f2b-install.log; }
sudo tee /etc/fail2ban/jail.local >/dev/null <<'EOF'
[DEFAULT]
bantime  = 2h
findtime = 10m
maxretry = 4
backend  = systemd
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/16 151.145.85.158
banaction = nftables
banaction_allports = nftables[type=allports]

[sshd]
enabled = true
mode    = aggressive
EOF
sudo systemctl enable --now fail2ban >/dev/null 2>&1
sleep 3
sudo fail2ban-client status sshd 2>&1 | head -8

echo "== 6. secret file permissions"
for f in /opt/ogen-play/.env.local /opt/supabase/docker/.env; do
  [ -f "$f" ] && { sudo chmod 600 "$f"; stat -c '%a %U %n' "$f"; }
done
echo "== 7. services still fine?"
systemctl is-active ogen-play ogen-play-b ogen-play-c nginx docker ssh fail2ban | paste -sd' '
printf "site -> "; curl -sk -m 10 --resolve ogenplay.com:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://ogenplay.com/
echo "== files to revert: /etc/sysctl.d/90-ogen-hardening.conf /etc/ssh/sshd_config.d/01-ogen-hardening.conf /etc/fail2ban/jail.local ; rpcbind: systemctl unmask rpcbind.service rpcbind.socket"
