-- Starter-Service-Items für Pilot-Hotel (c827efae-7343-4979-90e7-3d44fbcc266a).
-- Nur einspielen wenn service_items noch leer ist — idempotent.

UPDATE public.hotel_settings
SET
  service_items = $items$[
    {
      "id": "extra-handtuecher",
      "name_de": "Extra Handtücher",
      "name_en": "Extra Towels",
      "description_de": "Wir bringen frische Handtücher auf dein Zimmer.",
      "description_en": "We will bring fresh towels to your room.",
      "icon": "towels"
    },
    {
      "id": "extra-kissen",
      "name_de": "Extra Kissen & Decke",
      "name_en": "Extra Pillows & Blanket",
      "description_de": "Zusätzliche Kissen oder eine Decke – einfach anfragen.",
      "description_en": "Request an extra pillow or blanket anytime.",
      "icon": "pillow"
    },
    {
      "id": "zimmerreinigung",
      "name_de": "Zimmerreinigung",
      "name_en": "Room Cleaning",
      "description_de": "Wir reinigen dein Zimmer zur gewünschten Zeit.",
      "description_en": "We will clean your room at a time that suits you.",
      "icon": "cleaning"
    },
    {
      "id": "weckruf",
      "name_de": "Weckruf",
      "name_en": "Wake-up Call",
      "description_de": "Persönlicher Weckruf am Morgen – gewünschte Uhrzeit angeben.",
      "description_en": "Personal wake-up call – just let us know the time.",
      "icon": "alarm"
    },
    {
      "id": "gepaeckaufbewahrung",
      "name_de": "Gepäckaufbewahrung",
      "name_en": "Luggage Storage",
      "description_de": "Gepäck sicher verwahren – vor oder nach dem Check-out.",
      "description_en": "Store your luggage securely before or after check-out.",
      "icon": "luggage"
    },
    {
      "id": "taxi",
      "name_de": "Taxi / Transfer",
      "name_en": "Taxi / Transfer",
      "description_de": "Wir bestellen ein Taxi oder organisieren deinen Transfer.",
      "description_en": "We will arrange a taxi or transfer for you.",
      "icon": "taxi"
    },
    {
      "id": "later-checkout",
      "name_de": "Später Check-out",
      "name_en": "Late Check-out",
      "description_de": "Reise länger und checke später aus – je nach Verfügbarkeit.",
      "description_en": "Stay a little longer – subject to availability.",
      "icon": "checkout"
    }
  ]$items$::jsonb,
  updated_at = now()
WHERE hotel_id = 'c827efae-7343-4979-90e7-3d44fbcc266a'
  AND (service_items IS NULL OR jsonb_array_length(service_items) = 0);
