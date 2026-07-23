import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Statistiques1Component } from './statistiques1.component';

describe('Statistiques1Component', () => {
  let component: Statistiques1Component;
  let fixture: ComponentFixture<Statistiques1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Statistiques1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Statistiques1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
