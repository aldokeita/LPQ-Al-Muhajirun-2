import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { resolveSantriTier } from '@/lib/santriTier';

/**
 * Lambang tier santri untuk baris identitas kartu absensi.
 *
 * Gambarnya berdiri sendiri tanpa kartu, bingkai, atau latar: yang memberi bobot
 * hanyalah aura radial dan bayangan jatuh, dengan warna mengikuti accent tier.
 *
 * Ukuran kotaknya diatur sepenuhnya oleh stylesheet, bukan oleh gaya inline:
 * menyetelnya di sini akan mengalahkan media query dan membuat ukurannya sama di
 * ponsel maupun desktop. Atribut width dan height memakai dimensi asli berkas,
 * yang memberi peramban rasio aspeknya sejak awal sehingga tidak ada pergeseran
 * tata letak ketika gambarnya selesai dimuat.
 *
 * Kalau berkasnya tidak ada atau gagal dimuat, yang tampil adalah ikon cadangan,
 * bukan ikon gambar rusak bawaan peramban.
 */
const UKURAN_INTRINSIK = 256;

const TierEmblem = ({ levelInfo }) => {
  const [gagalMuat, setGagalMuat] = useState(false);
  const { name, asset, accentColor } = resolveSantriTier(levelInfo);

  const pakaiCadangan = !asset || gagalMuat;
  const aura = accentColor || 'rgba(148, 163, 184, 0.9)';

  return (
    <span
      className="attendance-profile-card__tier-emblem"
      style={{ '--tier-emblem-aura': aura }}
    >
      {pakaiCadangan ? (
        <span
          className="attendance-profile-card__tier-emblem-fallback"
          role="img"
          aria-label={name ? `Simbol tier ${name} belum tersedia` : 'Simbol tier belum tersedia'}
          title={name ? `Simbol tier ${name} belum tersedia` : 'Simbol tier belum tersedia'}
        >
          <Award aria-hidden="true" />
        </span>
      ) : (
        <img
          className="attendance-profile-card__tier-emblem-img"
          src={asset}
          alt={`Simbol tier ${name}`}
          width={UKURAN_INTRINSIK}
          height={UKURAN_INTRINSIK}
          loading="eager"
          decoding="async"
          draggable="false"
          onError={() => setGagalMuat(true)}
        />
      )}
    </span>
  );
};

export default TierEmblem;
