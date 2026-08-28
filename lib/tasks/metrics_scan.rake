namespace :metrics do
  desc "Scan system anomalies: burst reviews, 24h average deltas, and banned user ratios"
  task scan: :environment do
    report = AnomalyWatcher.scan

    puts "============================================================"
    puts "METRICS ANOMALY SCAN — #{report[:scanned_at]}"
    puts "============================================================"

    puts "\n1. Reviews/min (Spike > 50 in 1h):"
    if report[:burst_alerts].empty?
      puts "   ✓ Sin ráfagas anómalas detectadas."
    else
      report[:burst_alerts].each do |alert|
        puts "   ⚠️ [MODERACIÓN] #{alert[:message]}"
      end
    end

    puts "\n2. Average Delta (> 1.0 in 24h):"
    if report[:average_delta_alerts].empty?
      puts "   ✓ Sin saltos bruscos de promedio en 24h."
    else
      report[:average_delta_alerts].each do |alert|
        puts "   ⚠️ [MODERACIÓN] #{alert[:message]}"
      end
    end

    puts "\n3. Ratio Banned/Total Reviewers (7d):"
    banned_info = report[:banned_ratio_alert]
    if banned_info[:alert]
      puts "   ⚠️ [GROWTH] #{banned_info[:message]} (#{banned_info[:banned_reviewers]}/#{banned_info[:total_reviewers]})"
    else
      puts "   ✓ #{banned_info[:message]} (#{banned_info[:banned_reviewers]}/#{banned_info[:total_reviewers]})"
    end
    puts "============================================================"
  end
end
