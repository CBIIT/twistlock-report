CREATE TABLE
  public.components (
    id serial NOT NULL,
    project text NOT NULL,
    image_name text NOT NULL,
    current_tag text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
  );

ALTER TABLE
  public.components
ADD
  CONSTRAINT components_pkey PRIMARY KEY (id)


CREATE TABLE
  public.scans (
    id serial NOT NULL,
    component_id integer NOT NULL,
    week text NOT NULL,
    scanned_at timestamp with time zone NOT NULL,
    vuln_count integer NOT NULL,
    scanned_tag text NULL
  );

ALTER TABLE
  public.scans
ADD
  CONSTRAINT scans_pkey PRIMARY KEY (id)


CREATE TABLE
  public.vulnerabilities (
    id serial NOT NULL,
    scan_id integer NOT NULL,
    cve_id text NULL,
    severity text NULL,
    package_name text NULL,
    package_version text NULL,
    fix_status text NULL,
    cvss numeric NULL,
    description text NULL,
    image_id text NULL,
    image_name text NULL
  );

ALTER TABLE
  public.vulnerabilities
ADD
  CONSTRAINT vulnerabilities_pkey PRIMARY KEY (id)



  CREATE TABLE iam (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    service VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL
);