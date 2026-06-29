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
  Hash,
} from 'lucide-react';

/**
 * AttendanceProfileCard — Shared premium profile card for attendance results.
 *
 * Props:
 * - variant: 'student' | 'teacher'
 * - name, photo, role, status, time
 * - For student: jilid, points, kelas, sesi, nis, gender, levelInfo
 * - For teacher: jabatan, no_hp, sesi, guruStats
 * - quote, message, showSuccessBadge
 */
const AttendanceProfileCard = ({
  variant = 'student',
  name,
  photo,
  role,
  status,
  time,
  jilid,
  points,
  kelas,
  sesi,
  nis,
  rfid,
  gender,
  levelInfo,
  jabatan,
  no_hp,
  guruStats,
  quote,
  message,
  showSuccessBadge = false,
  isPentashih = false,
}) => {
  const isTeacher = variant === 'teacher';

  // Level info for students
  const {
    label: levelLabel,
    color: levelColor,
    badgeIcon: levelBadgeIcon,
    enableGradient,
    textColor,
    avatarBorderThickness,
    textGradient,
  } = levelInfo || {};

  // Status color mapping
  const statusConfig = getStatusConfig(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="attendance-profile-card"
      role="region"
      aria-label={`Profil ${isTeacher ? 'Guru' : 'Santri'}: ${name}`}
    >
      {/* Identity Header */}
      <div className="attendance-profile-card__header">
        <div className="attendance-profile-card__avatar-wrap">
          <Avatar
            className="attendance-profile-card__avatar"
            style={
              !isTeacher && levelColor
                ? {
                    borderColor: levelColor,
                    borderWidth: `${avatarBorderThickness || 3}px`,
                    boxShadow: `0 0 24px ${levelColor}33, 0 8px 32px rgba(0,0,0,0.12)`,
                  }
                : undefined
            }
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

          {/* Level badge for students */}
          {!isTeacher && levelLabel && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="attendance-profile-card__level-badge"
              style={{ borderColor: levelColor || 'var(--att-accent)' }}
            >
              <span
                className={enableGradient ? 'gradient-text' : ''}
                style={{ color: enableGradient ? undefined : levelColor || 'var(--att-accent)' }}
              >
                {levelLabel}
              </span>
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

        <div className="attendance-profile-card__identity">
          <h2
            className="attendance-profile-card__name"
            style={
              !isTeacher && textGradient && textColor
                ? { color: textColor }
                : undefined
            }
          >
            {name}
          </h2>

          {/* Subtitle: jabatan for teacher, jilid for student */}
          {isTeacher && jabatan && (
            <p className="attendance-profile-card__subtitle">{jabatan}</p>
          )}
          {!isTeacher && jilid && (
            <p className="attendance-profile-card__subtitle">{jilid}</p>
          )}
        </div>
      </div>

      {/* Status & Time Section */}
      {status && (
        <div className="attendance-profile-card__status-row">
          <div
            className="attendance-profile-card__status-chip"
            style={{
              backgroundColor: `${statusConfig.color}12`,
              borderColor: `${statusConfig.color}30`,
              color: statusConfig.color,
            }}
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
                <DetailItem
                  icon={<Briefcase className="w-4 h-4" />}
                  label="Sesi"
                  value={guruStats.session}
                  accent
                />
                <DetailItem
                  icon={<Clock className="w-4 h-4" />}
                  label="Jam Total"
                  value={guruStats.hours}
                />
                <DetailItem
                  icon={<Star className="w-4 h-4" />}
                  label="Streak"
                  value={guruStats.streak}
                  amber
                />
              </>
            )}
            {sesi && !guruStats && (
              <DetailItem
                icon={<Calendar className="w-4 h-4" />}
                label="Sesi"
                value={sesi}
                accent
              />
            )}
            {rfid && (
              <DetailItem
                icon={<Fingerprint className="w-4 h-4" />}
                label="RFID"
                value={rfid}
                mono
              />
            )}
          </>
        ) : (
          <>
            {jilid && (
              <DetailItem
                icon={<BookOpen className="w-4 h-4" />}
                label="Jilid"
                value={jilid}
                accent
              />
            )}
            {points !== undefined && points !== null && (
              <DetailItem
                icon={<Star className="w-4 h-4" />}
                label="Poin"
                value={points}
                amber
              />
            )}
            {kelas && (
              <DetailItem
                icon={<Users className="w-4 h-4" />}
                label="Kelas"
                value={kelas}
              />
            )}
            {sesi && (
              <DetailItem
                icon={<Calendar className="w-4 h-4" />}
                label="Sesi"
                value={sesi}
                accent
              />
            )}
            {rfid && (
              <DetailItem
                icon={<Fingerprint className="w-4 h-4" />}
                label="RFID"
                value={rfid}
                mono
              />
            )}
          </>
        )}
      </div>

      {/* Message */}
      {message && (
        <p className="attendance-profile-card__message">{message}</p>
      )}

      {/* Quote */}
      {quote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="attendance-profile-card__quote"
        >
          <p>"{quote}"</p>
        </motion.div>
      )}
    </motion.div>
  );
};

/* --- Detail Item Sub-component --- */
const DetailItem = ({ icon, label, value, accent, amber, mono }) => (
  <div
    className="attendance-profile-card__detail-item"
    style={
      amber
        ? { borderColor: 'var(--att-amber-border)', backgroundColor: 'var(--att-amber-bg)' }
        : accent
          ? { borderColor: 'var(--att-accent-border)', backgroundColor: 'var(--att-accent-bg)' }
          : undefined
    }
  >
    <div
      className="attendance-profile-card__detail-icon"
      style={
        amber
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
        style={amber ? { color: 'var(--att-amber)' } : undefined}
      >
        {value}
      </span>
    </div>
  </div>
);

/* --- Status Config Helper --- */
function getStatusConfig(status) {
  switch (status) {
    case 'Hadir':
    case 'Tepat Waktu':
      return {
        label: 'Tepat Waktu',
        color: 'var(--att-success)',
        icon: <CheckCircle className="w-4 h-4" />,
      };
    case 'Terlambat':
      return {
        label: 'Terlambat',
        color: 'var(--att-amber)',
        icon: <Clock className="w-4 h-4" />,
      };
    case 'Tidak Hadir':
    case 'Alpha':
      return {
        label: 'Tidak Hadir',
        color: 'var(--att-danger)',
        icon: <span className="w-4 h-4 flex items-center justify-center">&#x2716;</span>,
      };
    case 'Izin':
      return {
        label: 'Izin',
        color: 'var(--att-cyan)',
        icon: <span className="w-4 h-4 flex items-center justify-center">&#9998;</span>,
      };
    case 'Sakit':
      return {
        label: 'Sakit',
        color: 'var(--att-violet)',
        icon: <span className="w-4 h-4 flex items-center justify-center">&#9829;</span>,
      };
    default:
      return {
        label: status || 'Unknown',
        color: 'var(--att-text-muted)',
        icon: <Clock className="w-4 h-4" />,
      };
  }
}

export default AttendanceProfileCard;