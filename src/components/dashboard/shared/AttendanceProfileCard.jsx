import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle,
  Clock,
  BookOpen,
  GraduationCap,
  Users,
  Star,
  Crown,
  Globe2,
  Book,
  Briefcase,
  Fingerprint,
  Calendar,
} from 'lucide-react';

/**
 * AttendanceProfileCard — Shared premium profile card for attendance results.
 * Center-aligned, portrait-optimized layout.
 */
const AttendanceProfileCard = ({
  variant = 'student',
  name,
  photo,
  status,
  time,
  jilid,
  points,
  kelas,
  sesi,
  rfid,
  levelInfo,
  monthlyStats,
  hafalanCount,
  jabatan,
  guruStats,
  quote,
  message,
  showSuccessBadge = false,
  isPentashih = false,
}) => {
  const isTeacher = variant === 'teacher';

  const {
    color: levelColor,
    avatarBorderThickness,
  } = levelInfo || {};

  const pointAccent = !isTeacher ? getPointAccent(points) : null;
  const pointLevel = !isTeacher ? getPointLevel(points) : null;
  const statusConfig = getStatusConfig(status);
  const displayMessage = formatAttendanceMessage(message);
  const nameGradient = pointAccent
    ? `linear-gradient(135deg, ${pointAccent.gradientStart}, ${pointAccent.gradientEnd})`
    : isTeacher
      ? 'linear-gradient(135deg, #047857, #22c55e)'
      : levelColor
        ? `linear-gradient(135deg, ${levelColor}, color-mix(in srgb, ${levelColor} 58%, white))`
        : 'linear-gradient(135deg, #047857, #34d399)';
  const visualAccent = pointAccent || {
    color: '#169b62',
    soft: 'rgba(22, 155, 98, 0.12)',
    glow: 'rgba(22, 155, 98, 0.26)',
  };
  const cardStyle = {
    '--attendance-profile-accent': visualAccent.color,
    '--attendance-profile-accent-soft': visualAccent.soft,
    '--attendance-profile-accent-glow': visualAccent.glow,
  };
  const studentStatusStyle = pointAccent
    ? {
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderColor: pointAccent.color,
        color: pointAccent.color,
      }
    : {
        backgroundColor: `${statusConfig.color}14`,
        borderColor: `${statusConfig.color}30`,
        color: statusConfig.color,
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`attendance-profile-card attendance-profile-card--white-glass ${isTeacher ? 'attendance-profile-card--teacher' : 'attendance-profile-card--student'} ${pointAccent ? 'attendance-profile-card--point-glow' : ''}`}
      style={cardStyle}
      role="region"
      aria-label={`Profil ${isTeacher ? 'Guru' : 'Santri'}: ${name}`}
    >
      {/* Avatar — large, centered, top anchor */}
      <div className="attendance-profile-card__avatar-wrap">
          <Avatar
            className="attendance-profile-card__avatar"
            style={{
              width: '100%',
              height: '100%',
              ...(!isTeacher && levelColor
                ? {
                    borderColor: pointAccent?.color || levelColor,
                    borderWidth: `${avatarBorderThickness || 4}px`,
                    boxShadow: pointAccent
                      ? `0 0 28px ${pointAccent.glow}, 0 8px 28px rgba(0,0,0,0.10)`
                      : `0 0 20px ${levelColor}22, 0 8px 28px rgba(0,0,0,0.10)`,
                  }
                : {}),
            }}
          >
          <AvatarImage src={photo} alt={name} className="object-cover" />
          <AvatarFallback className="attendance-profile-card__avatar-fallback">
            {name?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        {showSuccessBadge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 20 }}
            className="attendance-profile-card__success-badge"
          >
            <CheckCircle className="w-5 h-5" />
          </motion.div>
        )}

        {/* Role badge for teachers */}
        {isTeacher && (
          <div className="attendance-profile-card__role-badge">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>{isPentashih ? 'Pentashih' : 'Guru'}</span>
          </div>
        )}
      </div>

      {/* Name — primary hierarchy, centered */}
      <h2
        className="attendance-profile-card__name attendance-profile-card__name--gradient"
        style={{ '--attendance-name-gradient': nameGradient }}
      >
        {name}
      </h2>

      {/* Subtitle */}
      {isTeacher && jabatan && (
        <p className="attendance-profile-card__subtitle">{jabatan}</p>
      )}
      {!isTeacher && jilid && (
        <p className="attendance-profile-card__subtitle">{jilid}</p>
      )}

      {/* Status & Time */}
      {status && (
        <div className="attendance-profile-card__status-row">
          <div
            className="attendance-profile-card__status-chip"
            style={studentStatusStyle}
          >
            {statusConfig.icon}
            <span className="font-semibold">{statusConfig.label}</span>
          </div>
          {time && (
            <div className="attendance-profile-card__time-chip">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{time}</span>
            </div>
          )}
        </div>
      )}

      {/* Details Grid */}
      <div className="attendance-profile-card__details">
        {isTeacher ? (
          <>
            {guruStats && (
              <>
                <DetailItem icon={<Briefcase className="w-4 h-4" />} label="Sesi" value={guruStats.session} accent />
                <DetailItem icon={<Clock className="w-4 h-4" />} label="Jam Total" value={guruStats.hours} />
                <DetailItem icon={<Star className="w-4 h-4" />} label="Streak" value={guruStats.streak} amber />
              </>
            )}
            {sesi && !guruStats && (
              <DetailItem icon={<Calendar className="w-4 h-4" />} label="Sesi" value={sesi} accent />
            )}
            {rfid && (
              <DetailItem icon={<Fingerprint className="w-4 h-4" />} label="RFID" value={rfid} mono />
            )}
          </>
        ) : (
          <>
            {jilid && (
              <DetailItem icon={<BookOpen className="w-4 h-4" />} label="Jilid" value={jilid} pointAccent={pointAccent} accent />
            )}
            {points !== undefined && points !== null && (
              <DetailItem icon={<Star className="w-4 h-4" />} label="Poin" value={points} pointAccent={pointAccent} amber />
            )}
            {pointLevel && (
              <DetailItem icon={<Crown className="w-4 h-4" />} label="Level" value={pointLevel} pointAccent={pointAccent} />
            )}
            {hafalanCount !== undefined && hafalanCount !== null && (
              <DetailItem icon={<Book className="w-4 h-4" />} label="Hafalan" value={hafalanCount} pointAccent={pointAccent} />
            )}
            {monthlyStats && (
              <DetailItem icon={<CheckCircle className="w-4 h-4" />} label="Kehadiran" value={monthlyStats.present ?? 0} pointAccent={pointAccent} />
            )}
            {monthlyStats && (
              <DetailItem icon={<Clock className="w-4 h-4" />} label="Tidak Hadir" value={monthlyStats.absent ?? 0} pointAccent={pointAccent} />
            )}
            {kelas && (
              <DetailItem icon={<Users className="w-4 h-4" />} label="Kelas" value={kelas} />
            )}
            {sesi && (
              <DetailItem icon={<Calendar className="w-4 h-4" />} label="Sesi" value={sesi} accent />
            )}
            {rfid && (
              <DetailItem icon={<Fingerprint className="w-4 h-4" />} label="RFID" value={rfid} mono />
            )}
          </>
        )}
      </div>

      {/* Message */}
      {displayMessage && (
        <div className="attendance-profile-card__message">
          <span className="attendance-profile-card__message-icon" aria-hidden="true">
            <CheckCircle className="w-4 h-4" />
          </span>
          <p>{displayMessage}</p>
        </div>
      )}

      {/* Quote */}
      {quote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="attendance-profile-card__quote"
        >
          <p>&ldquo;{quote}&rdquo;</p>
        </motion.div>
      )}
    </motion.div>
  );
};

/* --- Detail Item --- */
const DetailItem = ({ icon, label, value, accent, amber, mono, pointAccent }) => (
  <div
    className="attendance-profile-card__detail-item"
    style={
      pointAccent
        ? {
            borderColor: pointAccent.color,
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
          }
        : amber
        ? { borderColor: 'var(--att-amber-border)', backgroundColor: 'var(--att-amber-bg)' }
        : accent
          ? { borderColor: 'var(--att-accent-border)', backgroundColor: 'var(--att-accent-bg)' }
          : undefined
    }
  >
    <div
      className="attendance-profile-card__detail-icon"
      style={
        pointAccent
          ? { color: pointAccent.color }
          : amber
          ? { color: 'var(--att-amber)' }
          : accent
            ? { color: 'var(--att-accent)' }
            : undefined
      }
    >
      {icon}
    </div>
    <div className="attendance-profile-card__detail-text">
      <span className="attendance-profile-card__detail-label">{label}</span>
      <span
        className={`attendance-profile-card__detail-value ${mono ? 'font-mono' : ''}`}
        style={pointAccent ? { color: pointAccent.color } : amber ? { color: 'var(--att-amber)' } : undefined}
      >
        {value}
      </span>
    </div>
  </div>
);

function getPointAccent(points = 0) {
  const safePoints = Number(points) || 0;
  if (safePoints <= 20) {
    return {
      color: '#22c55e',
      gradientStart: '#15803d',
      gradientEnd: '#4ade80',
      soft: 'rgba(34, 197, 94, 0.14)',
      glow: 'rgba(34, 197, 94, 0.5)',
    };
  }
  if (safePoints <= 50) {
    return {
      color: '#2563eb',
      gradientStart: '#1d4ed8',
      gradientEnd: '#60a5fa',
      soft: 'rgba(37, 99, 235, 0.14)',
      glow: 'rgba(37, 99, 235, 0.5)',
    };
  }
  if (safePoints <= 80) {
    return {
      color: '#f97316',
      gradientStart: '#c2410c',
      gradientEnd: '#fb923c',
      soft: 'rgba(249, 115, 22, 0.16)',
      glow: 'rgba(249, 115, 22, 0.55)',
    };
  }
  return {
    color: '#ef4444',
    gradientStart: '#b91c1c',
    gradientEnd: '#fb7185',
    soft: 'rgba(239, 68, 68, 0.16)',
    glow: 'rgba(239, 68, 68, 0.55)',
  };
}

function getPointLevel(points = 0) {
  const safePoints = Number(points) || 0;
  if (safePoints <= 20) return 'Santri Biasa';
  if (safePoints <= 50) return 'Santri Rajin';
  if (safePoints <= 80) return 'Santri Super';
  return 'Santri Legend';
}

/* --- Status Config --- */
function getStatusConfig(status) {
  switch (status) {
    case 'Hadir':
    case 'Tepat Waktu':
      return { label: 'Tepat Waktu', color: 'var(--att-success)', icon: <CheckCircle className="w-4 h-4" /> };
    case 'Terlambat':
      return { label: 'Terlambat', color: 'var(--att-amber)', icon: <Clock className="w-4 h-4" /> };
    case 'Tidak Hadir':
    case 'Alpha':
      return { label: 'Tidak Hadir', color: 'var(--att-danger)', icon: <span className="w-4 h-4 flex items-center justify-center">&#x2716;</span> };
    case 'Izin':
      return { label: 'Izin', color: 'var(--att-cyan)', icon: <span className="w-4 h-4 flex items-center justify-center">&#9998;</span> };
    case 'Sakit':
      return { label: 'Sakit', color: 'var(--att-violet)', icon: <span className="w-4 h-4 flex items-center justify-center">&#9829;</span> };
    default:
      return { label: status || 'Unknown', color: 'var(--att-text-muted)', icon: <Clock className="w-4 h-4" /> };
  }
}

function formatAttendanceMessage(message) {
  if (!message) return message;

  const normalizedMessage = String(message);
  if (/berhasil\s+melakukan\s+absensi/i.test(normalizedMessage)) {
    return 'Absensi Sesi Sore berhasil.';
  }

  return normalizedMessage
    .replace(/\bpada\s+sesi\s*3\b/gi, 'pada Sesi Sore')
    .replace(/\bsesi\s*3\b/gi, 'Sesi Sore');
}

export default AttendanceProfileCard;
