-- Create exercises table based on CSV structure
CREATE TABLE public.exercises (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty INTEGER NOT NULL DEFAULT 5,
    machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
    requires_machine BOOLEAN NOT NULL DEFAULT false,
    primary_muscles TEXT[] NOT NULL DEFAULT '{}',
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    contraindicated_injuries TEXT[] NOT NULL DEFAULT '{}',
    video_path TEXT,
    description TEXT,
    workout_split TEXT[] NOT NULL DEFAULT '{}',
    movement_pattern TEXT,
    equipment TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Anyone can view exercises
CREATE POLICY "Anyone can view exercises"
ON public.exercises
FOR SELECT
USING (true);

-- Admins can insert exercises
CREATE POLICY "Admins can insert exercises"
ON public.exercises
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update exercises
CREATE POLICY "Admins can update exercises"
ON public.exercises
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete exercises
CREATE POLICY "Admins can delete exercises"
ON public.exercises
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_exercises_updated_at
BEFORE UPDATE ON public.exercises
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();