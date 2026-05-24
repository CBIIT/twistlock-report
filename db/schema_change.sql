-- ============================================================
-- 1. Create project_image_mapping
--    One row per project + image_name
-- ============================================================

CREATE TABLE public.project_image_mapping (
    id serial PRIMARY KEY,
    project text NOT NULL,
    image_name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT project_image_mapping_unique
        UNIQUE (project, image_name)
);


-- ============================================================
-- 2. Create image_tag_mapping
--    One row per image + tag
--    is_prod indicates whether this tag is production
-- ============================================================

CREATE TABLE public.image_tag_mapping (
    id serial PRIMARY KEY,
    project_image_mapping_id integer NOT NULL,
    image_name text NOT NULL,
    current_tag text NOT NULL,
    is_prod boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT image_tag_mapping_project_image_fk
        FOREIGN KEY (project_image_mapping_id)
        REFERENCES public.project_image_mapping (id)
        ON DELETE CASCADE,

    CONSTRAINT image_tag_mapping_unique
        UNIQUE (project_image_mapping_id, current_tag)
);


-- ============================================================
-- Migrate existing components data into project_image_mapping
-- Keep id, project, image_name exactly the same as components
-- ============================================================

INSERT INTO public.project_image_mapping (
    id,
    project,
    image_name,
    created_at
)
SELECT
    id,
    project,
    image_name,
    created_at
FROM public.components;


SELECT setval(
    pg_get_serial_sequence('public.project_image_mapping', 'id'),
    COALESCE((SELECT MAX(id) FROM public.project_image_mapping), 1),
    true
);


-- ============================================================
-- Migrate existing components data into image_tag_mapping
-- Keep id aligned with components.id
-- ============================================================

INSERT INTO public.image_tag_mapping (
    id,
    project_image_mapping_id,
    image_name,
    current_tag,
    is_prod,
    created_at
)
SELECT
    c.id,
    c.id AS project_image_mapping_id,
    c.image_name,
    c.current_tag,
    true AS is_prod,
    c.created_at
FROM public.components c;


SELECT setval(
    pg_get_serial_sequence('public.image_tag_mapping', 'id'),
    COALESCE((SELECT MAX(id) FROM public.image_tag_mapping), 1),
    true
);


--    -- ============================================================
-- -- 6. Add FK from scans.component_id to image_tag_mapping.id
-- -- ============================================================

-- ALTER TABLE public.scans
-- ADD CONSTRAINT scans_component_id_image_tag_mapping_fk
-- FOREIGN KEY (component_id)
-- REFERENCES public.image_tag_mapping (id)
-- ON DELETE CASCADE;


-- ============================================================
-- Get the latest one production image/tag rows
-- ============================================================


SELECT DISTINCT ON (pim.project, pim.image_name)
    pim.project,
    pim.image_name,
    itm.current_tag,
    itm.is_prod,
    itm.created_at
FROM public.project_image_mapping pim
JOIN public.image_tag_mapping itm
    ON itm.project_image_mapping_id = pim.id
WHERE itm.is_prod = true
ORDER BY
    pim.project,
    pim.image_name,
    itm.created_at DESC,
    itm.id DESC;