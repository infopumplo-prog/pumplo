-- Create gyms table
CREATE TABLE public.gyms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  opening_hours JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

-- Create gym_machines table (machines in a specific gym)
CREATE TABLE public.gym_machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  max_weight_kg NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gym_id, machine_id)
);

-- Enable RLS
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_machines ENABLE ROW LEVEL SECURITY;

-- RLS policies for gyms
CREATE POLICY "Business users can view their own gym"
ON public.gyms FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view published gyms"
ON public.gyms FOR SELECT
USING (is_published = true);

CREATE POLICY "Business users can insert their gym"
ON public.gyms FOR INSERT
WITH CHECK (auth.uid() = owner_id AND has_role(auth.uid(), 'business'::app_role));

CREATE POLICY "Business users can update their gym"
ON public.gyms FOR UPDATE
USING (auth.uid() = owner_id AND has_role(auth.uid(), 'business'::app_role));

CREATE POLICY "Business users can delete their gym"
ON public.gyms FOR DELETE
USING (auth.uid() = owner_id AND has_role(auth.uid(), 'business'::app_role));

-- RLS policies for gym_machines
CREATE POLICY "Anyone can view machines of published gyms"
ON public.gym_machines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_machines.gym_id 
    AND (gyms.is_published = true OR gyms.owner_id = auth.uid())
  )
);

CREATE POLICY "Gym owners can insert machines"
ON public.gym_machines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_machines.gym_id 
    AND gyms.owner_id = auth.uid()
  )
);

CREATE POLICY "Gym owners can update machines"
ON public.gym_machines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_machines.gym_id 
    AND gyms.owner_id = auth.uid()
  )
);

CREATE POLICY "Gym owners can delete machines"
ON public.gym_machines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_machines.gym_id 
    AND gyms.owner_id = auth.uid()
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_gyms_updated_at
BEFORE UPDATE ON public.gyms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gym_machines_updated_at
BEFORE UPDATE ON public.gym_machines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();