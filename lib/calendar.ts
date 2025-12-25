import { Booking, CallOffer, User, Creator } from '@prisma/client';

interface BookingWithRelations extends Booking {
  callOffer: CallOffer & {
    creator: Creator & {
      user: User;
    };
  };
  user: User;
}

export function generateICS(booking: BookingWithRelations): string {
  const { callOffer, user } = booking;
  const creatorName = callOffer.creator.user.name;
  const startDate = new Date(callOffer.dateTime);
  const endDate = new Date(startDate.getTime() + callOffer.duration * 60000);

  // Format dates for ICS (YYYYMMDDTHHMMSSZ)
  const formatDate = (date: Date) => {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  };

  const now = formatDate(new Date());
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  // Generate a unique UID for the event
  const uid = `${booking.id}@call-a-star.com`;

  // Build the ICS content
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Call a Star//Video Call Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Appel vidéo avec ${creatorName}`,
    `DESCRIPTION:${callOffer.title}\n\n${callOffer.description}${booking.dailyRoomUrl ? `\n\nLien de l'appel: ${booking.dailyRoomUrl}` : ''}`,
    `ORGANIZER;CN=${creatorName}:mailto:${callOffer.creator.user.email}`,
    `ATTENDEE;CN=${user.name}:mailto:${user.email}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    booking.dailyRoomUrl ? `URL:${booking.dailyRoomUrl}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel: Appel vidéo dans 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter((line) => line !== '') // Remove empty lines
    .join('\r\n');

  return icsContent;
}

export function getICSFilename(booking: BookingWithRelations): string {
  const creatorName = booking.callOffer.creator.user.name
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  const date = new Date(booking.callOffer.dateTime).toISOString().split('T')[0];
  return `call-${creatorName}-${date}.ics`;
}
