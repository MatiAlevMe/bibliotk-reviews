class AnomalyWatcher
  BURST_HOURLY_THRESHOLD = 50
  DELTA_24H_THRESHOLD = 1.0
  BANNED_RATIO_7D_THRESHOLD = 0.05

  def self.scan
    new.scan
  end

  def scan
    {
      burst_alerts: check_review_bursts,
      average_delta_alerts: check_average_deltas,
      banned_ratio_alert: check_banned_ratio,
      scanned_at: Time.current
    }
  end

  # 1. Reviews/min por libro: alerta si >50 en 1 hora -> Moderación
  def check_review_bursts(since: 1.hour.ago, threshold: BURST_HOURLY_THRESHOLD)
    Review
      .where("created_at >= ?", since)
      .group(:book_id)
      .having("COUNT(*) > ?", threshold)
      .count
      .map do |book_id, count|
        book = Book.find_by(id: book_id)
        {
          book_id: book_id,
          title: book&.title,
          reviews_count: count,
          threshold: threshold,
          target: "moderation",
          message: "Libro ##{book_id} superó el umbral con #{count} reseñas en la última hora (límite: #{threshold})"
        }
      end
  end

  # 2. Average delta por libro: alerta si cambia >1.0 en 24h -> Moderación
  def check_average_deltas(since: 24.hours.ago, threshold: DELTA_24H_THRESHOLD)
    ModerationNotification
      .where("created_at >= ?", since)
      .where("ABS(new_average - previous_average) > ?", threshold)
      .order(created_at: :desc)
      .map do |notification|
        delta = (notification.new_average.to_f - notification.previous_average.to_f).round(1)
        {
          book_id: notification.book_id,
          title: notification.book&.title,
          previous_average: notification.previous_average.to_f,
          new_average: notification.new_average.to_f,
          delta: delta,
          threshold: threshold,
          target: "moderation",
          message: "Libro ##{notification.book_id} tuvo un salto de promedio de #{delta.abs}★ en 24h (anterior: #{notification.previous_average}, nuevo: #{notification.new_average})"
        }
      end
  end

  # 3. Ratio banned/total reviewers: alerta si >5% en 7 días -> Growth
  def check_banned_ratio(since: 7.days.ago, threshold: BANNED_RATIO_7D_THRESHOLD)
    reviewers_scope = User.joins(:reviews).where("reviews.created_at >= ?", since).distinct
    total_reviewers = reviewers_scope.count

    return { alert: false, ratio: 0.0, total_reviewers: 0, banned_reviewers: 0 } if total_reviewers.zero?

    banned_reviewers = reviewers_scope.where(banned: true).count
    ratio = (banned_reviewers.to_f / total_reviewers).round(4)

    {
      alert: ratio > threshold,
      ratio: ratio,
      threshold: threshold,
      total_reviewers: total_reviewers,
      banned_reviewers: banned_reviewers,
      target: "growth",
      message: ratio > threshold ? "Ratio de usuarios baneados (#{((ratio * 100)).round(2)}%) superó el #{threshold * 100}% en los últimos 7 días" : "Ratio de usuarios baneados bajo control (#{((ratio * 100)).round(2)}%)"
    }
  end
end
