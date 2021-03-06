package org.cmo.cancerhotspots.service.internal;

import org.cmo.cancerhotspots.model.TumorTypeComposition;
import org.cmo.cancerhotspots.persistence.VariantRepository;
import org.cmo.cancerhotspots.service.VariantService;
import org.cmo.cancerhotspots.util.RangeConversion;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * @author Selcuk Onur Sumer
 */
@Service
public class HotspotVariantService implements VariantService
{
    private final VariantRepository variantRepository;

    // cache of <amino acid change, variant> pairs
    private Map<String, TumorTypeComposition> variantCacheByAAChange;
    // cache of <hugo symbol + amino acid change, variant> pairs
    private Map<String, TumorTypeComposition> variantCacheByGeneAndAAChange;

    @Autowired
    public HotspotVariantService(VariantRepository variantRepository)
    {
        this.variantRepository = variantRepository;
    }

    @Override
    public TumorTypeComposition getVariantComposition(String aminoAcidChange)
    {
        if (this.variantCacheByAAChange == null)
        {
            this.variantCacheByAAChange = constructVariantCacheByAAChange();
        }

        return variantCacheByAAChange.get(aminoAcidChange.toUpperCase());
    }

    @Override
    public TumorTypeComposition getVariantComposition(String hugoSymbol, String aminoAcidChange)
    {
        if (this.variantCacheByGeneAndAAChange == null)
        {
            this.variantCacheByGeneAndAAChange = constructVariantCacheByGeneAndAAChange();
        }

        return variantCacheByGeneAndAAChange.get(
            (hugoSymbol + "_" + aminoAcidChange).toUpperCase());
    }

    @Override
    public List<TumorTypeComposition> getAllVariantCompositions()
    {
        List<TumorTypeComposition> list = new ArrayList<>();

        for (TumorTypeComposition composition : variantRepository.findAll())
        {
            list.add(composition);
        }

        return list;
    }

    private Map<String, TumorTypeComposition> constructVariantCacheByGeneAndAAChange()
    {
        Map<String, TumorTypeComposition> variantCache = new HashMap<>();

        for (TumorTypeComposition variant : getAllVariantCompositions())
        {
            String key = (variant.getHugoSymbol() + "_" + aminoAcidChange(variant)).toUpperCase();
            variantCache.put(key, variant);
        }

        return variantCache;
    }

    private Map<String, TumorTypeComposition> constructVariantCacheByAAChange()
    {
        Map<String, TumorTypeComposition> variantCache = new HashMap<>();

        // TODO this is not accurate! we need to combine all gene specific info
        // together into one VariantComposition instance...

        for (TumorTypeComposition variant : getAllVariantCompositions())
        {
            String key = aminoAcidChange(variant).toUpperCase();
            variantCache.put(key, variant);
        }

        return variantCache;
    }

    private String aminoAcidChange(TumorTypeComposition variant)
    {
        String aaChange;

        // use residue if available
        if (variant.getResidue() != null)
        {
            aaChange = variant.getResidue() +
                       variant.getVariantAminoAcid();
        }
        else
        {
            RangeConversion converter = new RangeConversion();

            // this is for backward compatibility
            // (variant files with no residue column available)
            aaChange = variant.getReferenceAminoAcid() +
                       converter.revert(variant.getAminoAcidPosition()) +
                       variant.getVariantAminoAcid();
        }

        return aaChange;
    }
}
